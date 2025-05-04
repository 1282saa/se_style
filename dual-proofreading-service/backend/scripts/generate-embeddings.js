// scripts/generate-embeddings.js
require("dotenv").config();
const mongoose = require("mongoose");
const styleGuideService = require("../src/services/styleGuideService");
const logger = require("../src/utils/logger");

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

// 임베딩 생성
async function generateEmbeddings() {
  try {
    const connected = await connectDB();
    if (!connected) {
      process.exit(1);
    }

    // 모든 스타일 가이드에 대한 임베딩 생성
    logger.info("스타일 가이드 임베딩 생성 시작...");
    const result = await styleGuideService.generateAllEmbeddings(true);
    logger.info(`임베딩 생성 결과: ${JSON.stringify(result)}`);

    await mongoose.connection.close();
    logger.info("MongoDB 연결 종료");

    return result;
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
