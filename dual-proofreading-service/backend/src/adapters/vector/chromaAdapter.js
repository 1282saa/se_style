/**
 * src/adapters/vector/chromaAdapter.js
 * Chroma 벡터 데이터베이스 어댑터
 */
const logger = require("../../utils/logger");
const { Chroma } = require("@langchain/community/vectorstores/chroma");
const { OpenAIEmbeddings } = require("@langchain/openai");
const path = require("path");
const config = require("../../config");

class ChromaVectorAdapter {
  constructor() {
    this.embeddings = null;
    this.collections = {};
    this.initialized = false;
  }

  /**
   * 어댑터 초기화 및 연결
   * @returns {Promise<boolean>} - 초기화 성공 여부
   */
  async connect() {
    try {
      if (this.initialized) return true;

      // OpenAI 임베딩 초기화
      this.embeddings = new OpenAIEmbeddings({
        openAIApiKey: process.env.OPENAI_API_KEY,
        modelName: "text-embedding-3-small",
      });

      // 초기화 플래그 설정
      this.initialized = true;
      logger.info("Chroma 어댑터 초기화 완료");
      return true;
    } catch (error) {
      logger.error(`Chroma 어댑터 초기화 오류: ${error.message}`);
      return false;
    }
  }

  /**
   * MongoDB 필터를 Chroma where 쿼리로 변환
   * @param {Object} filter - MongoDB 스타일 필터
   * @returns {Object} Chroma where 쿼리
   */
  #transformFilter(filter = {}) {
    try {
      // 빈 필터면 빈 객체 반환
      if (!filter || Object.keys(filter).length === 0) {
        return {};
      }

      const whereQuery = {};

      // 기본 필드 필터링
      for (const [key, value] of Object.entries(filter)) {
        // 중첩된 조건이나 복잡한 쿼리는 무시하고 단순 필드만 변환
        if (typeof value === "object" && !Array.isArray(value)) {
          // $eq, $gt, $lt 등의 MongoDB 연산자 처리
          if (value.$eq !== undefined) whereQuery[key] = { $eq: value.$eq };
          if (value.$ne !== undefined) whereQuery[key] = { $ne: value.$ne };
          if (value.$gt !== undefined) whereQuery[key] = { $gt: value.$gt };
          if (value.$gte !== undefined) whereQuery[key] = { $gte: value.$gte };
          if (value.$lt !== undefined) whereQuery[key] = { $lt: value.$lt };
          if (value.$lte !== undefined) whereQuery[key] = { $lte: value.$lte };
          if (value.$in !== undefined) whereQuery[key] = { $in: value.$in };
        } else {
          // 단순 동등 조건
          whereQuery[key] = { $eq: value };
        }
      }

      logger.debug(`필터 변환됨: ${JSON.stringify(whereQuery)}`);
      return whereQuery;
    } catch (error) {
      logger.warn(`필터 변환 오류, 빈 필터 사용: ${error.message}`);
      return {};
    }
  }

  /**
   * 벡터 검색 수행
   * @param {Object} model - 검색할 모델 (MongoDB 모델)
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

      // 모델 이름에 따라 컬렉션 이름 결정
      const collectionName = model.collection.name;

      // 컬렉션이 없으면 생성
      if (!this.collections[collectionName]) {
        const persistDirectory = path.resolve(
          __dirname,
          "..",
          "..",
          "..",
          "db",
          "chromadb"
        );

        this.collections[collectionName] = new Chroma(this.embeddings, {
          collectionName: collectionName,
          url: config.CHROMA_URL || "http://localhost:8000",
          collectionMetadata: {
            "hnsw:space": "cosine",
          },
          persistDirectory,
        });
      }

      // MongoDB 필터를 Chroma where 쿼리로 변환
      const whereQuery = this.#transformFilter(filter);

      // 실제 벡터 검색 수행
      const vectorStore = this.collections[collectionName];

      const results = await vectorStore.similaritySearchVectorWithScore(
        queryVector,
        limit,
        whereQuery
      );

      // 결과 변환 (Chroma 결과 형식을 MongoDB 어댑터와 호환되도록)
      const formattedResults = results.map(([doc, score]) => {
        // 원본 메타데이터에서 MongoDB 문서 데이터 추출
        const metadata = doc.metadata || {};

        // MongoDB 문서 형식으로 변환
        return {
          ...metadata,
          [scoreField]: score,
          content: doc.pageContent,
        };
      });

      // 점수 필터링
      const filteredResults = formattedResults.filter(
        (result) => result[scoreField] >= minScore
      );

      logger.info(`Chroma 검색 결과: ${filteredResults.length}개`);
      return filteredResults;
    } catch (error) {
      logger.error(`Chroma 벡터 검색 오류: ${error.message}`);
      return [];
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
          .map((doc) => doc.ruleId)
          .filter(Boolean);

        // 각 부모에 대한 청크 검색
        for (const parentId of parentIds) {
          // 부모 ID로 청크 필터링
          const chunkFilter = {
            ...filter,
            isChunk: true,
            parentId: parentId,
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
            allChunks = [...allChunks, ...chunks];
          }
        }

        // 점수 기준 정렬
        allChunks.sort((a, b) => b[scoreField] - a[scoreField]);
      }

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
   * 문서 유형 기반 검색 - 특정 doc_type만 검색
   * @param {Object} model - 검색할 모델 (MongoDB 모델)
   * @param {Array<number>} queryVector - 쿼리 벡터
   * @param {string|Array<string>} docTypes - 검색할 문서 유형(들)
   * @param {Object} options - 검색 옵션
   * @returns {Promise<Array<Object>>} - 검색 결과
   */
  async searchByDocType(model, queryVector, docTypes, options = {}) {
    try {
      // docTypes를 항상 배열로 처리
      const types = Array.isArray(docTypes) ? docTypes : [docTypes];

      if (!types.length) {
        logger.warn(
          "문서 유형이 지정되지 않았습니다. 일반 검색으로 대체합니다."
        );
        return this.search(model, queryVector, options);
      }

      // 필터에 doc_type 조건 추가
      const filter = {
        ...options.filter,
        doc_type: { $in: types },
      };

      // 일반 검색 실행
      return this.search(model, queryVector, {
        ...options,
        filter,
      });
    } catch (error) {
      logger.error(`문서 유형 기반 검색 오류: ${error.message}`);
      return [];
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

  /**
   * 벡터 저장 (단일 문서)
   * @param {string} collectionName - 컬렉션 이름
   * @param {string} docId - 문서 ID
   * @param {Array<number>} vector - 임베딩 벡터
   * @param {Object} metadata - 문서 메타데이터
   * @param {string} content - 문서 내용
   * @returns {Promise<boolean>} - 성공 여부
   */
  async addVector(collectionName, docId, vector, metadata = {}, content = "") {
    try {
      await this.connect();

      if (!this.collections[collectionName]) {
        const persistDirectory = path.resolve(
          __dirname,
          "..",
          "..",
          "..",
          "db",
          "chromadb"
        );

        this.collections[collectionName] = new Chroma(this.embeddings, {
          collectionName: collectionName,
          url: config.CHROMA_URL || "http://localhost:8000",
          persistDirectory,
        });
      }

      const vectorStore = this.collections[collectionName];

      await vectorStore.addVectors(
        [vector],
        [{ pageContent: content, metadata }],
        [docId]
      );

      logger.info(`Chroma에 벡터 추가 완료: ${collectionName}/${docId}`);
      return true;
    } catch (error) {
      logger.error(`Chroma 벡터 추가 오류: ${error.message}`);
      return false;
    }
  }

  /**
   * 다중 벡터 저장
   * @param {string} collectionName - 컬렉션 이름
   * @param {Array<string>} docIds - 문서 ID 배열
   * @param {Array<Array<number>>} vectors - 임베딩 벡터 배열
   * @param {Array<Object>} metadatas - 메타데이터 배열
   * @param {Array<string>} contents - 문서 내용 배열
   * @returns {Promise<boolean>} - 성공 여부
   */
  async addVectors(
    collectionName,
    docIds,
    vectors,
    metadatas = [],
    contents = []
  ) {
    try {
      await this.connect();

      if (!this.collections[collectionName]) {
        const persistDirectory = path.resolve(
          __dirname,
          "..",
          "..",
          "..",
          "db",
          "chromadb"
        );

        this.collections[collectionName] = new Chroma(this.embeddings, {
          collectionName: collectionName,
          url: config.CHROMA_URL || "http://localhost:8000",
          persistDirectory,
        });
      }

      const vectorStore = this.collections[collectionName];

      // 문서 객체 구성
      const documents = vectors.map((_, i) => ({
        pageContent: contents[i] || "",
        metadata: metadatas[i] || {},
      }));

      await vectorStore.addVectors(vectors, documents, docIds);

      logger.info(
        `Chroma에 ${vectors.length}개 벡터 일괄 추가 완료: ${collectionName}`
      );
      return true;
    } catch (error) {
      logger.error(`Chroma 다중 벡터 추가 오류: ${error.message}`);
      return false;
    }
  }
}

module.exports = new ChromaVectorAdapter();
