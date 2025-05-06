// scripts/generate-embeddings.js
require("dotenv").config();
const mongoose = require("mongoose");
const styleGuideService = require("../src/services/styleGuideService");
const logger = require("../src/utils/logger");
const config = require("../src/config");
const path = require("path");
const Styleguide = require("../src/models/styleguide.model");
const embeddingProvider = require("../src/services/rag/embeddingProvider");
const { Chroma } = require("@langchain/community/vectorstores/chroma");
const { OpenAIEmbeddings } = require("@langchain/openai");
const { Document } = require("@langchain/core/documents");

// Chroma DB 초기화
let vectorStore = null;
async function initializeChroma() {
  try {
    // OpenAI API 키 확인
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY가 설정되지 않았습니다.");
    }

    // Embedding 모델 초기화
    const embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: "text-embedding-3-small",
    });

    if (!embeddings) {
      throw new Error("유효한 임베딩 모델 인스턴스를 가져올 수 없습니다.");
    }

    // Chroma DB 영속성 디렉토리 설정
    const persistDirectory = path.resolve(__dirname, "..", "db", "chromadb");
    logger.info(`Chroma DB 영속성 디렉토리: ${persistDirectory}`);

    // Chroma 벡터 저장소 초기화
    const chroma = new Chroma(embeddings, {
      collectionName: config.CHROMA_COLLECTION_NAME || "styleguides",
      url: config.CHROMA_URL || "http://localhost:8000",
      collectionMetadata: {
        "hnsw:space": "cosine",
      },
      persistDirectory,
    });

    logger.info(
      `Chroma DB 초기화 완료 (컬렉션: ${
        config.CHROMA_COLLECTION_NAME || "styleguides"
      })`
    );
    return chroma;
  } catch (error) {
    logger.error(`Chroma DB 초기화 오류: ${error.message}`, {
      stack: error.stack,
    });
    return null;
  }
}

// 연결 확인
async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    logger.info(`MongoDB에 연결되었습니다: ${process.env.MONGODB_URI}`);
    return true;
  } catch (error) {
    logger.error(`MongoDB 연결 오류: ${error.message}`);
    return false;
  }
}

// Chroma에 스타일 가이드 임베딩 추가
async function addStyleGuidesToChroma(guides, chromaInstance) {
  try {
    if (!chromaInstance) {
      logger.warn("Chroma 인스턴스가 없어 Chroma에 저장을 건너뜁니다.");
      return 0;
    }

    const documents = [];
    const ids = [];

    // 스타일 가이드 문서를 Chroma 형식으로 변환
    for (const guide of guides) {
      // 임베딩 텍스트 생성
      const embeddingText = `카테고리: ${guide.category || ""}
섹션: ${guide.section || ""}
내용: ${guide.content || ""}`;

      // Chroma 문서 생성
      const doc = new Document({
        pageContent: embeddingText,
        metadata: {
          _id: guide._id.toString(),
          ruleId: guide.ruleId,
          section: guide.section,
          category: guide.category,
          priority: guide.priority || 3,
          isActive: guide.isActive !== false,
        },
      });

      documents.push(doc);
      ids.push(guide.ruleId);
    }

    if (documents.length === 0) {
      logger.info("Chroma에 추가할 문서가 없습니다.");
      return 0;
    }

    // Chroma에 문서 추가
    await chromaInstance.addDocuments(documents, { ids });
    logger.info(`${documents.length}개 문서를 Chroma에 추가했습니다.`);
    return documents.length;
  } catch (error) {
    logger.error(`Chroma에 문서 추가 중 오류: ${error.message}`);
    return 0;
  }
}

// 임베딩 생성
async function generateEmbeddings() {
  try {
    const connected = await connectDB();
    if (!connected) {
      process.exit(1);
    }

    // Chroma 사용 여부 확인
    const useChroma =
      process.env.USE_CHROMA === "true" || config.USE_CHROMA === true;
    let chromaInstance = null;

    if (useChroma) {
      logger.info("Chroma 벡터 저장소 초기화 중...");
      chromaInstance = await initializeChroma();
      if (!chromaInstance) {
        logger.warn("Chroma 초기화 실패, MongoDB만 사용하여 계속 진행합니다.");
      }
    }

    // 모든 스타일 가이드에 대한 임베딩 생성
    logger.info("스타일 가이드 임베딩 생성 시작...");
    const result = await styleGuideService.generateAllEmbeddings(true);
    logger.info(`MongoDB 임베딩 생성 결과: ${JSON.stringify(result)}`);

    let chromaCount = 0;
    if (chromaInstance) {
      // 임베딩이 있는 모든 스타일 가이드 조회
      logger.info("Chroma에 추가할 스타일 가이드 조회 중...");
      const guides = await Styleguide.find({
        vector: { $exists: true, $ne: null },
        isActive: true,
      }).select("+vector"); // vector 필드 포함

      if (guides.length > 0) {
        logger.info(`${guides.length}개 스타일 가이드를 Chroma에 추가합니다.`);
        chromaCount = await addStyleGuidesToChroma(guides, chromaInstance);
      } else {
        logger.warn("임베딩이 있는 스타일 가이드가 없습니다.");
      }
    }

    await mongoose.connection.close();
    logger.info("MongoDB 연결 종료");

    return {
      ...result,
      chromaCount,
    };
  } catch (error) {
    logger.error(`임베딩 생성 오류: ${error.message}`);
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
    process.exit(1);
  }
}

// 실행
generateEmbeddings()
  .then((result) => {
    console.log("임베딩 생성 완료:", result);
    process.exit(0);
  })
  .catch((error) => {
    console.error("임베딩 생성 실패:", error);
    process.exit(1);
  });
