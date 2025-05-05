/**
 * 교열 시스템의 날리지 서비스
 * XML로부터 임포트된 교열 규칙을 검색하고 활용
 */
const mongoose = require("mongoose");
const logger = require("../utils/logger");
const vectorAdapter = require("../adapters/vector/mongodb");
const embeddingProvider = require("./rag/embeddingProvider");
const cache = require("../utils/cache");

// 날리지 모델 임포트
const Knowledge = require("../models/knowledge.model");

class KnowledgeService {
  constructor() {
    this.cacheEnabled = true;
    this.cacheTTL = 3600; // 1시간 캐시
    logger.info("날리지 서비스 초기화 완료");
  }

  /**
   * 텍스트와 관련된 날리지 규칙을 검색합니다
   * @param {string} text - 검색할 원문 텍스트
   * @param {Object} options - 검색 옵션
   * @returns {Promise<Array>} - 관련 날리지 규칙 배열
   */
  async findRelevantRules(text, options = {}) {
    try {
      const {
        limit = 10,
        minScore = 0.6,
        type = null,
        category = null,
        tags = [],
        useCache = true,
      } = options;

      // 캐시 키 생성
      const textKey = text.substring(0, 100); // 첫 100자로 캐시 키 생성
      const cacheKey = `knowledge:${textKey}:${type || "all"}:${
        category || "all"
      }:${tags.join(",")}`;

      // 캐시 확인
      if (useCache && this.cacheEnabled) {
        const cached = cache.get(cacheKey);
        if (cached) {
          logger.debug(`날리지 캐시 적중: ${cacheKey}`);
          return cached;
        }
      }

      // 임베딩 생성
      logger.debug("텍스트 임베딩 생성 중...");
      const embedding = await embeddingProvider.createEmbedding(text);

      // 필터 준비
      const filter = {};
      if (type) filter.type = type;
      if (category) filter.category = category;
      if (tags && tags.length > 0) filter.tags = { $in: tags };

      // 벡터 검색
      logger.debug("날리지 벡터 검색 수행 중...");
      const searchResults = await vectorAdapter.search(Knowledge, embedding, {
        filter,
        limit: limit * 2, // 더 많은 결과를 가져온 후 필터링
        minScore,
        scoreField: "score",
      });

      // 결과가 없으면 기본 쿼리 수행
      if (!searchResults || searchResults.length === 0) {
        logger.debug("벡터 검색 결과 없음, 기본 쿼리 수행");
        return await this.fallbackQuery(filter, limit);
      }

      // 검색 결과 처리
      const sortedResults = searchResults
        .sort((a, b) => {
          // 우선순위와 유사도 점수를 조합한 정렬
          const priorityScore = b.priority - a.priority;
          const similarityDiff = b.score - a.score;
          return priorityScore * 0.3 + similarityDiff * 0.7;
        })
        .slice(0, limit);

      // 캐싱
      if (useCache && this.cacheEnabled) {
        cache.set(cacheKey, sortedResults, this.cacheTTL);
      }

      logger.info(`${sortedResults.length}개의 관련 날리지 규칙 검색 완료`);
      return sortedResults;
    } catch (error) {
      logger.error(`날리지 규칙 검색 오류: ${error.message}`);
      return [];
    }
  }

  /**
   * 기본 쿼리로 날리지 규칙 검색 (벡터 검색 실패 시)
   * @param {Object} filter - 필터 조건
   * @param {number} limit - 결과 제한
   * @returns {Promise<Array>} - 관련 날리지 규칙 배열
   * @private
   */
  async fallbackQuery(filter = {}, limit = 10) {
    try {
      return await Knowledge.find(filter).sort({ priority: -1 }).limit(limit);
    } catch (error) {
      logger.error(`기본 쿼리 오류: ${error.message}`);
      return [];
    }
  }

  /**
   * 유형별 날리지 규칙 요약을 가져옵니다
   * @returns {Promise<Object>} - 유형별 날리지 규칙 요약
   */
  async getKnowledgeSummary() {
    try {
      const cacheKey = "knowledge:summary";
      const cached = cache.get(cacheKey);
      if (cached) return cached;

      const summary = await Knowledge.aggregate([
        { $group: { _id: "$type", count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]);

      const result = {
        total: await Knowledge.countDocuments(),
        byType: {},
      };

      summary.forEach((item) => {
        result.byType[item._id] = item.count;
      });

      cache.set(cacheKey, result, 3600);
      return result;
    } catch (error) {
      logger.error(`날리지 요약 조회 오류: ${error.message}`);
      return { total: 0, byType: {} };
    }
  }

  /**
   * 카테고리 목록을 가져옵니다
   * @param {string} type - 날리지 유형
   * @returns {Promise<Array>} - 카테고리 목록
   */
  async getCategories(type = null) {
    try {
      const cacheKey = `knowledge:categories:${type || "all"}`;
      const cached = cache.get(cacheKey);
      if (cached) return cached;

      const query = type ? { type } : {};
      const categories = await Knowledge.distinct("category", query);

      cache.set(cacheKey, categories, 3600);
      return categories;
    } catch (error) {
      logger.error(`카테고리 조회 오류: ${error.message}`);
      return [];
    }
  }

  /**
   * 날리지 규칙을 프롬프트 텍스트로 변환합니다
   * @param {Array} rules - 날리지 규칙 배열
   * @param {Object} options - 변환 옵션
   * @returns {string} - 프롬프트용 텍스트
   */
  formatRulesForPrompt(rules, options = {}) {
    if (!rules || rules.length === 0) {
      return "참조할 날리지 규칙이 없습니다.";
    }

    const {
      maxLength = 2000,
      includeExamples = true,
      formatType = "basic",
    } = options;

    let result = "";

    // 형식에 따라 다르게 포맷팅
    if (formatType === "detailed") {
      result = rules
        .map((rule) => {
          let ruleText = `## [${rule.category}] ${rule.type}\n${rule.rule}`;

          if (rule.explanation) {
            ruleText += `\n설명: ${rule.explanation}`;
          }

          if (includeExamples && rule.examples && rule.examples.length > 0) {
            ruleText += "\n예시:";
            rule.examples.forEach((example, idx) => {
              ruleText += `\n- 잘못됨: ${example.incorrect}`;
              ruleText += `\n  올바름: ${example.correct}`;
              if (example.explanation) {
                ruleText += `\n  이유: ${example.explanation}`;
              }
            });
          }

          return ruleText;
        })
        .join("\n\n");
    } else {
      // 기본 형식
      result = rules
        .map((rule) => {
          return `[${rule.category}] ${rule.rule}`;
        })
        .join("\n\n");
    }

    // 길이 제한
    if (result.length > maxLength) {
      return result.substring(0, maxLength) + "...";
    }

    return result;
  }
}

module.exports = new KnowledgeService();
