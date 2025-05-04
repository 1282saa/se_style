// src/services/styleGuideService.js
const Styleguide = require("../models/styleguide.model");
const llmService = require("./llm/llm.service");
const logger = require("../utils/logger");

class StyleGuideService {
  /**
   * 텍스트와 관련된 스타일 가이드를 검색합니다.
   * @param {string} text - 검색할 텍스트
   * @param {number} limit - 최대 결과 수
   * @returns {Promise<Array>} - 관련 스타일 가이드 배열
   */
  async findRelatedStyleGuides(text, limit = 5) {
    try {
      // 텍스트 분석을 위한 키워드 추출 (간단한 구현)
      const keywords = this.extractKeywords(text);
      logger.debug(`추출된 키워드: ${keywords.join(", ")}`);

      // 벡터 검색 사용 가능 여부 확인
      const hasVectorSearch = await this.checkVectorSearchAvailability();

      if (hasVectorSearch) {
        // 벡터 검색 사용
        return this.vectorSearch(text, limit);
      } else {
        // 키워드 기반 검색 사용
        return this.keywordSearch(keywords, limit);
      }
    } catch (error) {
      logger.error(`관련 스타일 가이드 검색 오류: ${error.message}`);
      throw new Error(`관련 스타일 가이드 검색 중 오류 발생: ${error.message}`);
    }
  }

  /**
   * 벡터 검색을 사용할 수 있는지 확인합니다.
   * @returns {Promise<boolean>} - 벡터 검색 사용 가능 여부
   */
  async checkVectorSearchAvailability() {
    try {
      // 벡터가 있는 스타일 가이드 개수 확인
      const count = await Styleguide.countDocuments({
        vector: { $exists: true, $ne: null },
      });

      return count > 0;
    } catch (error) {
      logger.error(`벡터 검색 가용성 확인 오류: ${error.message}`);
      return false;
    }
  }

  /**
   * 키워드 기반 검색을 수행합니다.
   * @param {Array} keywords - 검색 키워드 배열
   * @param {number} limit - 최대 결과 수
   * @returns {Promise<Array>} - 검색 결과 배열
   */
  async keywordSearch(keywords, limit) {
    if (!keywords || keywords.length === 0) {
      return [];
    }

    try {
      // 키워드 기반 쿼리 구성
      const keywordQueries = keywords.map((keyword) => ({
        $or: [
          { section: { $regex: keyword, $options: "i" } },
          { content: { $regex: keyword, $options: "i" } },
          { tags: { $regex: keyword, $options: "i" } },
        ],
      }));

      // 검색 실행
      const results = await Styleguide.find({
        $or: keywordQueries,
      })
        .sort({ priority: -1 })
        .limit(limit);

      return results;
    } catch (error) {
      logger.error(`키워드 검색 오류: ${error.message}`);
      return [];
    }
  }

  /**
   * 텍스트에서 키워드를 추출합니다.
   * @param {string} text - 키워드를 추출할 텍스트
   * @returns {Array} - 추출된 키워드 배열
   */
  extractKeywords(text) {
    if (!text) return [];

    try {
      // 불용어 정의 (한국어)
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

      // 불용어 제거 및 최소 길이 필터링
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

      return keywords;
    } catch (error) {
      logger.error(`키워드 추출 오류: ${error.message}`);
      return [];
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
      // 텍스트 임베딩 생성
      const embedding = await llmService.createEmbedding(text);

      // MongoDB Atlas 벡터 검색 사용 시
      try {
        const results = await Styleguide.vectorSearch(embedding, limit);
        if (results && results.length > 0) {
          return results;
        }
      } catch (error) {
        logger.warn(`MongoDB 벡터 검색 오류, 대체 방법 사용: ${error.message}`);
      }

      // 대체 방법: 코사인 유사도 계산
      const guides = await Styleguide.find({
        vector: { $exists: true, $ne: null },
      }).select("+vector");

      // 유사도 계산 및 정렬
      const scoredGuides = guides
        .map((guide) => ({
          ...guide.toObject(),
          score: this.cosineSimilarity(embedding, guide.vector),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      return scoredGuides;
    } catch (error) {
      logger.error(`벡터 검색 오류: ${error.message}`);
      // 오류 발생 시 키워드 검색으로 폴백
      const keywords = this.extractKeywords(text);
      return this.keywordSearch(keywords, limit);
    }
  }

  /**
   * 두 벡터 간의 코사인 유사도를 계산합니다.
   * @param {Array} vecA - 첫 번째 벡터
   * @param {Array} vecB - 두 번째 벡터
   * @returns {number} - 코사인 유사도 (-1 ~ 1)
   */
  cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length) {
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
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
      const embeddingText = `${styleGuide.section}: ${styleGuide.content}`;

      // 임베딩 생성
      const embedding = await llmService.createEmbedding(embeddingText);

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
      const stats = { total: styleGuides.length, success: 0, failed: 0 };

      // 임베딩 생성 (순차 처리)
      for (const guide of styleGuides) {
        const success = await this.generateEmbedding(guide._id);
        if (success) {
          stats.success++;
        } else {
          stats.failed++;
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
              existingGuide[key] = item[key];
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
