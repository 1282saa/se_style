// src/services/styleGuideService.js
const mongoose = require("mongoose");
const Styleguide = require("../models/styleguide.model");
const anthropicService = require("./llm/anthropicService");
const embeddingProvider = require("./rag/embeddingProvider");
const logger = require("../utils/logger");
const cache = require("../utils/cache");

/**
 * 스타일 가이드 서비스
 * - RAG(Retrieval Augmented Generation) 구현
 * - 스타일북 데이터 관리 및 검색
 */
class StyleGuideService {
  /**
   * 텍스트와 관련된 스타일 가이드를 검색합니다.
   * @param {string} text - 검색할 텍스트
   * @param {number} limit - 최대 결과 수
   * @returns {Promise<Array>} - 관련 스타일 가이드 배열
   */
  async findRelatedStyleguides(text, limit = 10) {
    try {
      if (!text) {
        logger.warn("빈 텍스트로 스타일 가이드 검색 시도");
        return [];
      }

      // 캐시 키 생성 (텍스트 해시 기준)
      const cacheKey = `style:${Buffer.from(text.substring(0, 200)).toString(
        "base64"
      )}`;

      // 캐시 확인
      const cachedResults = cache.get(cacheKey);
      if (cachedResults) {
        logger.debug(`스타일 가이드 캐시 적중: ${cacheKey}`);
        return cachedResults;
      }

      // 텍스트 길이 제한
      const maxTextLength = 1000;
      const searchText =
        text.length > maxTextLength ? text.substring(0, maxTextLength) : text;

      // 1. 벡터 검색 시도
      logger.info("벡터 검색 사용하여 스타일 가이드 검색");
      try {
        const results = await this.vectorSearch(searchText, limit);
        if (results && results.length > 0) {
          logger.info(`벡터 검색 결과: ${results.length}개`);

          // 캐시에 저장
          cache.set(cacheKey, results, 3600); // 1시간 캐시

          return results;
        }
      } catch (error) {
        logger.error(
          `임베딩 생성 오류: ${error.message}. 키워드 검색으로 전환합니다.`
        );
      }

      // 2. 키워드 검색 (대체 방법)
      const keywordResults = await this.keywordSearch(
        this.extractKeywords(searchText),
        limit
      );
      logger.info(`키워드 검색 결과: ${keywordResults.length}개`);

      // 캐시에 저장
      cache.set(cacheKey, keywordResults, 3600); // 1시간 캐시

      return keywordResults;
    } catch (error) {
      logger.error(`스타일 가이드 검색 오류: ${error.message}`);
      return []; // 오류 발생 시 빈 배열 반환
    }
  }

  /**
   * 벡터 임베딩이 있는 스타일 가이드가 존재하는지 확인합니다.
   * @returns {Promise<boolean>} - 벡터 임베딩 존재 여부
   */
  async hasVectorEmbeddings() {
    try {
      const count = await Styleguide.countDocuments({
        vector: { $exists: true, $ne: null },
      });
      return count > 0;
    } catch (error) {
      logger.error(`벡터 임베딩 확인 오류: ${error.message}`);
      return false;
    }
  }

  /**
   * 텍스트 임베딩을 사용한 벡터 검색을 수행합니다.
   * @param {string} text - 검색할 텍스트
   * @param {number} limit - 최대 결과 수
   * @returns {Promise<Array>} - 검색 결과 배열
   */
  async vectorSearch(text, limit) {
    try {
      // 텍스트 길이 제한
      const maxTextLength = 1000;
      const searchText =
        text.length > maxTextLength ? text.substring(0, maxTextLength) : text;

      // 텍스트 임베딩 생성 (anthropicService -> embeddingProvider)
      const embedding = await embeddingProvider.createEmbedding(searchText);
      if (!embedding || embedding.length === 0) {
        throw new Error("임베딩 생성 실패");
      }

      // MongoDB Atlas Vector Search 사용 (인덱스 이름: vector_index)
      const pipeline = [
        {
          $vectorSearch: {
            index: "vector_index",
            queryVector: embedding,
            path: "vector",
            numCandidates: limit * 3,
            limit: limit,
          },
        },
        {
          $match: {
            isActive: true,
          },
        },
        {
          $addFields: {
            score: { $meta: "searchScore" },
          },
        },
        {
          $sort: {
            score: -1,
          },
        },
        {
          $limit: limit,
        },
        {
          $project: {
            vector: 0, // 벡터는 응답에서 제외
          },
        },
      ];

      // 벡터 검색 실행
      const results = await Styleguide.aggregate(pipeline);

      if (results.length > 0) {
        // 사용 시간 업데이트
        const guideIds = results.map((guide) => guide._id);
        Styleguide.updateMany(
          { _id: { $in: guideIds } },
          { $set: { lastUsedAt: new Date() } }
        ).catch((err) =>
          logger.warn(`마지막 사용 시간 업데이트 실패: ${err.message}`)
        );
      }

      return results;
    } catch (vectorSearchError) {
      logger.warn(`벡터 검색 오류: ${vectorSearchError.message}`);

      // 대체 방법: 메모리 내 코사인 유사도 계산
      logger.info("메모리 내 코사인 유사도 계산 사용");

      try {
        // 임베딩 생성 (anthropicService -> embeddingProvider)
        const embedding = await embeddingProvider.createEmbedding(text);

        // 벡터가 있는 스타일 가이드 조회
        const allGuides = await Styleguide.find({
          vector: { $exists: true, $ne: null },
          isActive: true,
        }).select("+vector"); // vector 필드는 기본적으로 제외되므로 명시적으로 포함

        if (!allGuides || allGuides.length === 0) {
          logger.warn(
            "벡터가 있는 스타일 가이드가 없습니다. 키워드 검색으로 전환합니다."
          );
          const keywords = this.extractKeywords(text);
          return this.keywordSearch(keywords, limit);
        }

        // 코사인 유사도 계산
        const scoredGuides = allGuides
          .map((guide) => {
            const similarity = this.calculateCosineSimilarity(
              embedding,
              guide.vector
            );
            return {
              ...guide.toObject(),
              score: similarity,
            };
          })
          .filter((guide) => guide.score > 0.5) // 유사도가 일정 수준 이상인 것만 필터링
          .sort((a, b) => b.score - a.score) // 유사도 기준 내림차순 정렬
          .slice(0, limit); // 상위 N개만 선택

        logger.info(`코사인 유사도 계산 결과: ${scoredGuides.length}개`);

        return scoredGuides;
      } catch (error) {
        logger.error(`인메모리 유사도 계산 오류: ${error.message}`);
        throw error;
      }
    }
  }

  /**
   * 두 벡터 간의 코사인 유사도를 계산합니다.
   * @param {Array<number>} vecA - 첫 번째 벡터
   * @param {Array<number>} vecB - 두 번째 벡터
   * @returns {number} - 코사인 유사도 (-1 ~ 1)
   * @private
   */
  calculateCosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length) {
      return 0;
    }

    try {
      // 최적화를 위해 Float32Array 사용
      const vecATyped = new Float32Array(vecA);
      const vecBTyped = new Float32Array(vecB);

      let dotProduct = 0;
      let normA = 0;
      let normB = 0;

      for (let i = 0; i < vecATyped.length; i++) {
        dotProduct += vecATyped[i] * vecBTyped[i];
        normA += vecATyped[i] * vecATyped[i];
        normB += vecBTyped[i] * vecBTyped[i];
      }

      normA = Math.sqrt(normA);
      normB = Math.sqrt(normB);

      if (normA === 0 || normB === 0) {
        return 0;
      }

      return dotProduct / (normA * normB);
    } catch (error) {
      logger.error(`코사인 유사도 계산 오류: ${error.message}`);
      return 0;
    }
  }

  /**
   * 키워드 기반 검색을 수행합니다.
   * @param {Array} keywords - 검색 키워드 배열
   * @param {number} limit - 최대 결과 수
   * @returns {Promise<Array>} - 검색 결과 배열
   */
  async keywordSearch(keywords, limit = 5) {
    try {
      if (!keywords || keywords.length === 0) {
        return [];
      }

      // 키워드 정규식 패턴 생성
      const keywordPatterns = keywords.map(
        (keyword) => new RegExp(this.escapeRegExp(keyword), "i")
      );

      // 검색 쿼리 생성
      const query = {
        isActive: true,
        $or: [
          { section: { $in: keywordPatterns } },
          { content: { $in: keywordPatterns } },
          { tags: { $in: keywordPatterns } },
        ],
      };

      // 결과 검색
      const guides = await Styleguide.find(query)
        .sort({ priority: -1 })
        .limit(limit);

      logger.info(`키워드 검색 결과: ${guides.length}개`);

      return guides;
    } catch (error) {
      logger.error(`키워드 검색 오류: ${error.message}`);
      return [];
    }
  }

  /**
   * 정규식 특수문자를 이스케이프합니다.
   * @param {string} text - 이스케이프할 텍스트
   * @returns {string} - 이스케이프된 텍스트
   */
  escapeRegExp(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  /**
   * 텍스트에서 키워드를 추출합니다.
   * @param {string} text - 키워드를 추출할 텍스트
   * @returns {Array} - 추출된 키워드 배열
   */
  extractKeywords(text) {
    if (!text) return [];

    try {
      // 한국어 불용어 (예시)
      const stopwords = [
        "은",
        "는",
        "이",
        "가",
        "을",
        "를",
        "에",
        "의",
        "과",
        "와",
        "으로",
        "로",
        "이다",
        "있다",
        "하다",
        "그",
        "그리고",
        "그러나",
        "또한",
        "그런데",
        "이렇게",
        "저렇게",
        "그것",
        "이것",
        "저것",
        "그래서",
        "따라서",
        "때문에",
      ];

      // 텍스트 정규화 및 단어 분리
      const normalizedText = text
        .replace(/[^\w\s가-힣]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();

      const words = normalizedText.split(" ");

      // 불용어와 짧은 단어 제거
      const filteredWords = words.filter(
        (word) => word.length > 1 && !stopwords.includes(word)
      );

      // 단어 빈도 계산
      const wordFrequency = {};
      filteredWords.forEach((word) => {
        wordFrequency[word] = (wordFrequency[word] || 0) + 1;
      });

      // 빈도 기준 상위 키워드 추출
      const keywords = Object.entries(wordFrequency)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map((entry) => entry[0]);

      logger.debug(`추출된 키워드: ${keywords.join(", ")}`);

      return keywords;
    } catch (error) {
      logger.error(`키워드 추출 오류: ${error.message}`);
      return [];
    }
  }

  /**
   * 스타일 가이드에 대한 임베딩을 생성합니다.
   * @param {string} styleGuideId - 스타일 가이드 ID
   * @returns {Promise<boolean>} - 성공 여부
   */
  async generateEmbedding(styleGuideId) {
    try {
      // 스타일 가이드 조회
      const styleGuide = await Styleguide.findById(styleGuideId);
      if (!styleGuide) {
        logger.warn(
          `임베딩 생성 실패: 스타일 가이드를 찾을 수 없음 (ID: ${styleGuideId})`
        );
        return false;
      }

      // 임베딩용 텍스트 생성
      const embeddingText = `
제목: ${styleGuide.section}
내용: ${styleGuide.content}
카테고리: ${styleGuide.category}
${
  styleGuide.tags && styleGuide.tags.length > 0
    ? `태그: ${styleGuide.tags.join(", ")}`
    : ""
}
`.trim();

      // 임베딩 생성 (anthropicService -> embeddingProvider)
      const embedding = await embeddingProvider.createEmbedding(embeddingText);

      // 임베딩 저장
      styleGuide.vector = embedding;
      await styleGuide.save();

      logger.info(`스타일 가이드 임베딩 생성 완료 (ID: ${styleGuideId})`);
      return true;
    } catch (error) {
      logger.error(`임베딩 생성 오류 (ID: ${styleGuideId}): ${error.message}`);
      return false;
    }
  }

  /**
   * 모든 스타일 가이드에 대한 임베딩을 생성합니다.
   * @param {boolean} forceUpdate - 이미 임베딩이 있는 항목도 업데이트할지 여부
   * @returns {Promise<Object>} - 성공/실패 통계
   */
  async generateAllEmbeddings(forceUpdate = false) {
    try {
      // 쿼리 구성
      const query = forceUpdate ? {} : { vector: { $exists: false } };

      // 임베딩이 필요한 스타일 가이드 조회
      const styleGuides = await Styleguide.find(query);

      logger.info(`임베딩 생성 대상: ${styleGuides.length}개 항목`);

      if (styleGuides.length === 0) {
        return { total: 0, success: 0, failed: 0 };
      }

      // 임베딩 생성 결과 통계
      const stats = {
        total: styleGuides.length,
        success: 0,
        failed: 0,
        failedIds: [],
      };

      // 병렬 처리를 위한 청크 분할
      const chunkSize = 5; // API 속도 제한 고려
      const chunks = [];

      for (let i = 0; i < styleGuides.length; i += chunkSize) {
        chunks.push(styleGuides.slice(i, i + chunkSize));
      }

      // 청크별 병렬 처리
      for (const [chunkIndex, chunk] of chunks.entries()) {
        logger.info(`청크 ${chunkIndex + 1}/${chunks.length} 처리 중...`);

        // 청크 내 병렬 처리
        const results = await Promise.allSettled(
          chunk.map((guide) => this.generateEmbedding(guide._id))
        );

        // 결과 분석
        results.forEach((result, index) => {
          if (result.status === "fulfilled" && result.value) {
            stats.success++;
          } else {
            stats.failed++;
            stats.failedIds.push(chunk[index]._id);
            logger.warn(
              `임베딩 생성 실패 (ID: ${chunk[index]._id}): ${
                result.reason?.message || "알 수 없는 오류"
              }`
            );
          }
        });

        // API 속도 제한을 피하기 위한 지연
        if (chunkIndex < chunks.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      logger.info(
        `임베딩 생성 완료: 총 ${stats.total}개 중 ${stats.success}개 성공, ${stats.failed}개 실패`
      );
      return stats;
    } catch (error) {
      logger.error(`임베딩 생성 오류: ${error.message}`);
      throw new Error(`임베딩 생성 중 오류 발생: ${error.message}`);
    }
  }

  /**
   * 스타일북 데이터를 가져옵니다.
   * @param {Array} styleBookData - 스타일북 데이터 배열
   * @returns {Promise<Object>} - 가져오기 결과 통계
   */
  async importStyleBook(styleBookData) {
    try {
      if (!Array.isArray(styleBookData)) {
        throw new Error("스타일북 데이터는 배열 형식이어야 합니다.");
      }

      // 가져오기 결과 통계
      const stats = {
        total: styleBookData.length,
        created: 0,
        updated: 0,
        failed: 0,
        failedItems: [],
      };

      // 스타일북 항목 처리
      for (const item of styleBookData) {
        try {
          // 필수 필드 검증
          if (!item.section || !item.content || !item.category) {
            throw new Error(
              "필수 필드(section, content, category)가 누락되었습니다."
            );
          }

          // 기존 항목 검색
          const existingGuide = await Styleguide.findOne({
            section: item.section,
            category: item.category,
          });

          if (existingGuide) {
            // 기존 항목 업데이트
            Object.keys(item).forEach((key) => {
              if (key !== "_id") {
                // _id는 변경 불가
                existingGuide[key] = item[key];
              }
            });

            await existingGuide.save();
            stats.updated++;
          } else {
            // 새 항목 생성
            const newGuide = new Styleguide(item);
            await newGuide.save();
            stats.created++;
          }
        } catch (error) {
          stats.failed++;
          stats.failedItems.push({
            item: item.section || "제목 없음",
            error: error.message,
          });
          logger.error(`스타일북 항목 가져오기 오류: ${error.message}`);
        }
      }

      // 임베딩 생성 필요 여부 확인
      if (stats.created > 0 || stats.updated > 0) {
        logger.info("신규 및 업데이트된 스타일북 항목에 대한 임베딩 생성 시작");
        // 비동기적으로 임베딩 생성 (완료를 기다리지 않음)
        this.generateAllEmbeddings(false).catch((err) =>
          logger.error(`임베딩 생성 오류: ${err.message}`)
        );
      }

      logger.info(
        `스타일북 가져오기 완료: 총 ${stats.total}개 중 ${stats.created}개 생성, ${stats.updated}개 업데이트, ${stats.failed}개 실패`
      );
      return stats;
    } catch (error) {
      logger.error(`스타일북 가져오기 오류: ${error.message}`);
      throw new Error(`스타일북 가져오기 중 오류 발생: ${error.message}`);
    }
  }
}

module.exports = new StyleGuideService();
