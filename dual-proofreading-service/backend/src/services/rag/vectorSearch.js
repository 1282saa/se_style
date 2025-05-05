// src/services/rag/vectorSearch.js
//--------------------------------------------------
/**
 * Styleguide 벡터 검색 서비스
 *  - Anthropic 임베딩(getEmbedding)
 *  - MongoDB Atlas VectorSearch 또는 Pinecone 지원
 *  - Redis TTL 캐싱으로 비용 및 지연 최소화
 */

const logger = require("../../utils/logger");
const embeddingProvider = require("./embeddingProvider");
const mongoAdapter = require("../../adapters/vector/mongodb");
const cache = require("../../utils/cache");
const Styleguide = require("../../models/styleguide.model");

/**
 * 벡터 검색 서비스
 */
class VectorSearch {
  constructor() {
    this.adapter = mongoAdapter;
    this.defaultLimit = 10;
    this.defaultMinScore = 0.6;
  }

  /**
   * 텍스트와 관련된 스타일 가이드를 검색합니다.
   * @param {string} text - 검색할 텍스트
   * @param {Object} options - 검색 옵션
   * @returns {Promise<Array>} - 관련 스타일 가이드 배열
   */
  async findRelevantStyleguides(text, options = {}) {
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

      // 벡터 검색 시도
      logger.info("벡터 검색 사용하여 스타일 가이드 검색");

      try {
        const embedding = await embeddingProvider.createEmbedding(searchText);

        // 벡터 검색 수행
        const results = await this.searchByVector(Styleguide, embedding, {
          limit: options.limit || 10,
          minScore: options.minScore || 0.6,
          filter: { isActive: true },
        });

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

      // 키워드 검색으로 대체
      const keywords = this.extractKeywords(searchText);
      const keywordResults = await this.keywordSearch(
        keywords,
        options.limit || 10
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
   * 텍스트 기반 벡터 검색 수행
   * @param {Object} model - 검색할 모델
   * @param {string} text - 검색 텍스트
   * @param {Object} options - 검색 옵션
   * @returns {Promise<Array<Object>>} - 검색 결과
   */
  async searchByText(model, text, options = {}) {
    try {
      if (!text || typeof text !== "string") {
        logger.warn("검색 텍스트가 비어 있거나 유효하지 않습니다");
        return [];
      }

      // 캐시 키 생성
      const cacheKey = this.#generateCacheKey(model.modelName, text, options);
      const cachedResults = cache.get(cacheKey);
      if (cachedResults) {
        logger.debug(`벡터 검색 캐시 적중: ${cacheKey}`);
        return cachedResults;
      }

      // 검색 텍스트 임베딩 생성
      logger.debug(`검색 텍스트 임베딩 생성: ${text.substring(0, 50)}...`);
      const embedding = await embeddingProvider.createEmbedding(text);

      // 벡터 검색 수행
      const searchOptions = this.#prepareSearchOptions(options);
      const results = await this.searchByVector(
        model,
        embedding,
        searchOptions
      );

      // 결과 캐싱
      cache.set(cacheKey, results, 3600); // 1시간 캐시

      return results;
    } catch (error) {
      logger.error(`텍스트 기반 벡터 검색 오류: ${error.message}`);
      return [];
    }
  }

  /**
   * 벡터 기반 검색 수행
   * @param {Object} model - 검색할 모델
   * @param {Array<number>} vector - 검색 벡터
   * @param {Object} options - 검색 옵션
   * @returns {Promise<Array<Object>>} - 검색 결과
   */
  async searchByVector(model, vector, options = {}) {
    try {
      if (!vector || !Array.isArray(vector) || vector.length === 0) {
        logger.warn("검색 벡터가 비어 있거나 유효하지 않습니다");
        return [];
      }

      logger.debug(
        `벡터 검색 시작 (모델: ${model.modelName}, 차원: ${vector.length})`
      );
      const searchOptions = this.#prepareSearchOptions(options);
      const results = await this.adapter.search(model, vector, searchOptions);

      logger.debug(`벡터 검색 완료: ${results.length}개 결과`);
      return results;
    } catch (error) {
      logger.error(`벡터 기반 검색 오류: ${error.message}`);
      return [];
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
   * 검색 캐시 키 생성
   * @param {string} modelName - 모델 이름
   * @param {string} text - 검색 텍스트
   * @param {Object} options - 검색 옵션
   * @returns {string} - 캐시 키
   */
  #generateCacheKey(modelName, text, options = {}) {
    const textHash = Buffer.from(text).toString("base64").substring(0, 40);
    const optionsHash = JSON.stringify(options)
      .replace(/[^a-zA-Z0-9]/g, "")
      .substring(0, 20);
    return `vs:${modelName}:${textHash}:${optionsHash}`;
  }

  /**
   * 검색 옵션 준비
   * @param {Object} options - 원본 옵션
   * @returns {Object} - 준비된 옵션
   */
  #prepareSearchOptions(options = {}) {
    return {
      limit: options.limit || this.defaultLimit,
      minScore: options.minScore || this.defaultMinScore,
      filter: options.filter || {},
      vectorField: options.vectorField || "vector",
      includeVector: options.includeVector || false,
      scoreField: options.scoreField || "score",
    };
  }
}

module.exports = new VectorSearch();
