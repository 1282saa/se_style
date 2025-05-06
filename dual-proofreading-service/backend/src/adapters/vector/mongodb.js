/**
 * src/adapters/vector/mongodb.js
 * MongoDB를 사용한 벡터 검색 어댑터
 */
const mongoose = require("mongoose");
const logger = require("../../utils/logger");
const config = require("../../config");

class MongoDBVectorAdapter {
  constructor() {
    this.isConnected = false;
    this.vectorIndexName = "vector_index";
  }

  /**
   * 데이터베이스 연결
   */
  async connect() {
    if (this.isConnected) return;

    try {
      if (mongoose.connection.readyState !== 1) {
        await mongoose.connect(config.MONGODB_URI);
        logger.info("MongoDB 벡터 어댑터 연결 성공");
      }
      this.isConnected = true;
    } catch (error) {
      logger.error(`MongoDB 벡터 어댑터 연결 오류: ${error.message}`);
      throw error;
    }
  }

  /**
   * 벡터 검색을 수행합니다 (Atlas Vector Search가 불가능한 경우 대체 방식 사용)
   * @param {mongoose.Model} model - 검색할 모델
   * @param {Array<number>} queryVector - 쿼리 벡터
   * @param {Object} options - 검색 옵션
   * @returns {Promise<Array<Object>>} - 검색 결과
   */
  async search(model, queryVector, options = {}) {
    try {
      await this.connect();

      const {
        vectorField = "vector",
        limit = 10,
        minScore = 0.6,
        filter = {},
        includeVector = false,
        scoreField = "score",
      } = options;

      // 메모리 내 벡터 검색 사용 (Atlas가 없는 환경에서)
      logger.info("메모리 내 벡터 유사도 계산 사용");

      // 필터 조건에 맞는 모든 문서 조회
      const documents = await model
        .find({
          ...filter,
          [vectorField]: { $exists: true, $ne: null },
        })
        .select(`+${vectorField}`);

      if (!documents || documents.length === 0) {
        logger.warn(`벡터 필드가 있는 문서가 없습니다: ${model.modelName}`);
        return [];
      }

      // 코사인 유사도 계산
      const results = this.memorySearch(documents, queryVector, {
        vectorField,
        limit,
        minScore,
        includeVector,
        scoreField,
      });

      logger.info(`메모리 내 유사도 계산 결과: ${results.length}개`);
      return results;
    } catch (error) {
      logger.error(`벡터 검색 오류: ${error.message}`);
      return [];
    }
  }

  /**
   * 인메모리 벡터 검색 (Atlas Vector Search 대체용)
   * @param {Array<Object>} documents - 문서 배열
   * @param {Array<number>} queryVector - 쿼리 벡터
   * @param {Object} options - 검색 옵션
   * @returns {Array<Object>} - 검색 결과
   */
  memorySearch(documents, queryVector, options = {}) {
    const {
      vectorField = "vector",
      limit = 10,
      minScore = 0.6,
      includeVector = false,
      scoreField = "score",
    } = options;

    // 코사인 유사도 계산
    const results = documents
      .map((doc) => {
        const docVector = doc[vectorField];

        // 벡터가 없는 문서는 건너뛰기
        if (!docVector || !Array.isArray(docVector) || docVector.length === 0) {
          return null;
        }

        // 코사인 유사도 계산
        const similarity = this.calculateCosineSimilarity(
          queryVector,
          docVector
        );

        // 문서를 일반 객체로 변환
        const resultDoc = doc.toObject ? doc.toObject() : { ...doc };

        // 유사도 점수 추가
        resultDoc[scoreField] = similarity;

        // 벡터 필드 제거 (옵션)
        if (!includeVector) {
          delete resultDoc[vectorField];
        }

        return resultDoc;
      })
      .filter((doc) => doc !== null && doc[scoreField] >= minScore)
      .sort((a, b) => b[scoreField] - a[scoreField])
      .slice(0, limit);

    return results;
  }

  /**
   * 코사인 유사도 계산
   * @param {Array<number>} vecA - 첫 번째 벡터
   * @param {Array<number>} vecB - 두 번째 벡터
   * @returns {number} - 코사인 유사도 (-1 ~ 1)
   */
  calculateCosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length) {
      return 0;
    }

    try {
      // Float32Array로 변환하여 계산 최적화
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
   * 연결 종료
   */
  async disconnect() {
    if (!this.isConnected) return;

    try {
      if (mongoose.connection.readyState === 1) {
        await mongoose.connection.close();
      }
      this.isConnected = false;
      logger.info("MongoDB 벡터 어댑터 연결 종료");
    } catch (error) {
      logger.error(`MongoDB 벡터 어댑터 연결 종료 오류: ${error.message}`);
    }
  }

  /**
   * 계층적 검색 수행 - 상위 문서 검색 후 필요시 관련 청크 검색
   * @param {Object} model - 검색할 모델 (MongoDB 모델)
   * @param {Array<number>} queryVector - 쿼리 벡터
   * @param {Object} options - 검색 옵션
   * @returns {Promise<Object>} - 계층적 검색 결과
   */
  async hierarchicalSearch(model, queryVector, options = {}) {
    try {
      await this.connect();

      const {
        limit = 5,
        minScore = 0.6,
        filter = {},
        scoreField = "score",
        includeChunks = true,
        chunksLimit = 3,
        chunksMinScore = 0.65,
      } = options;

      // Step 1: 먼저 상위 문서 검색 (청크가 아닌 원본 문서)
      const parentFilter = {
        ...filter,
        isChunk: { $ne: true }, // 청크가 아닌 문서만 검색
      };

      const parentResults = await this.search(model, queryVector, {
        limit,
        minScore,
        filter: parentFilter,
        scoreField,
      });

      // 결과가 없으면 빈 객체 반환
      if (!parentResults || parentResults.length === 0) {
        logger.warn("계층적 검색: 상위 문서를 찾을 수 없습니다");
        return {
          documents: [],
          chunks: [],
        };
      }

      // Step 2: 필요하면 관련 청크 검색
      let allChunks = [];
      if (includeChunks) {
        // 부모 문서 ID 수집
        const parentIds = parentResults
          .map((doc) => doc.ruleId || doc._id)
          .filter(Boolean);

        if (parentIds.length > 0) {
          logger.debug(
            `계층적 검색: ${parentIds.length}개 부모 ID에 대한 청크 검색`
          );

          // 각 부모에 대한 청크 검색
          for (const parentId of parentIds) {
            // 부모 ID로 청크 필터링
            const chunkFilter = {
              ...filter,
              isChunk: true,
              parentId: parentId.toString(),
            };

            // 청크 검색
            const chunks = await this.search(model, queryVector, {
              limit: chunksLimit,
              minScore: chunksMinScore,
              filter: chunkFilter,
              scoreField,
            });

            // 결과에 부모 ID 정보 추가 및 병합
            if (chunks && chunks.length > 0) {
              logger.debug(
                `ID ${parentId}에 대한 청크 ${chunks.length}개 발견`
              );
              allChunks = [...allChunks, ...chunks];
            }
          }

          // 점수 기준 정렬
          allChunks.sort((a, b) => b[scoreField] - a[scoreField]);
        }
      }

      logger.info(
        `계층적 검색 결과: ${parentResults.length}개 문서, ${allChunks.length}개 청크`
      );

      // 최종 결과 구성
      return {
        documents: parentResults,
        chunks: allChunks,
      };
    } catch (error) {
      logger.error(`계층적 벡터 검색 오류: ${error.message}`);
      return { documents: [], chunks: [] };
    }
  }

  /**
   * 카테고리 기반 계층적 검색 - 카테고리별로 상위 문서를 그룹화
   * @param {Object} model - 검색할 모델 (MongoDB 모델)
   * @param {Array<number>} queryVector - 쿼리 벡터
   * @param {Object} options - 검색 옵션
   * @returns {Promise<Object>} - 카테고리별 그룹화된 검색 결과
   */
  async categorySearch(model, queryVector, options = {}) {
    try {
      await this.connect();

      const {
        limit = 20, // 더 많은 결과 검색 (그룹화 전)
        minScore = 0.6,
        filter = {},
        scoreField = "score",
        includeChunks = false,
      } = options;

      // 청크가 아닌 문서만 검색
      const searchFilter = {
        ...filter,
        isChunk: { $ne: true },
      };

      // 검색 실행
      const results = await this.search(model, queryVector, {
        limit,
        minScore,
        filter: searchFilter,
        scoreField,
      });

      // 결과 없으면 빈 객체 반환
      if (!results || results.length === 0) {
        return { categories: {} };
      }

      // 카테고리별 그룹화
      const categories = {};
      for (const doc of results) {
        const category = doc.category || "기타";
        if (!categories[category]) {
          categories[category] = [];
        }
        categories[category].push(doc);
      }

      // 각 카테고리 내에서 점수 기준 정렬
      for (const category in categories) {
        categories[category].sort((a, b) => b[scoreField] - a[scoreField]);
      }

      // 필요시 청크 검색 추가
      if (includeChunks) {
        // hierarchicalSearch 메서드 호출하여 청크 포함
        const { documents, chunks } = await this.hierarchicalSearch(
          model,
          queryVector,
          options
        );
        return {
          categories,
          chunks,
        };
      }

      return { categories };
    } catch (error) {
      logger.error(`카테고리 기반 검색 오류: ${error.message}`);
      return { categories: {} };
    }
  }
}

module.exports = new MongoDBVectorAdapter();
