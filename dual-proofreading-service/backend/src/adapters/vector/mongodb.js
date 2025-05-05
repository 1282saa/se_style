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
}

module.exports = new MongoDBVectorAdapter();
