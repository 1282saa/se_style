// src/app.js 상단 수정
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const config = require("./config");
const routes = require("./routes");
const logger = require("./utils/logger");

// Express 앱 생성
const app = express();

// 미들웨어 설정
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// CORS 설정 업데이트
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:3002",
    ], // 모든 개발 포트 허용
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"], // OPTIONS 메소드 추가
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

// 로깅 미들웨어
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// 헬스체크 엔드포인트 추가
app.get("/health", (req, res) => {
  res
    .status(200)
    .json({ status: "ok", message: "서버가 정상적으로 실행 중입니다." });
});

// 모든 라우트 설정
app.use(routes);

// 404 오류 처리
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: "요청한 리소스를 찾을 수 없습니다",
  });
});

// 전역 오류 처리
app.use((err, req, res, next) => {
  logger.error(`오류 처리: ${err.message}`);

  const statusCode = err.statusCode || 500;
  const message = err.message || "서버 내부 오류가 발생했습니다";

  res.status(statusCode).json({
    success: false,
    message,
    stack: config.NODE_ENV === "development" ? err.stack : undefined,
  });
});

// 데이터베이스 연결
const connectDB = async () => {
  try {
    // 옵션 경고 제거
    await mongoose.connect(config.MONGODB_URI);

    logger.info("MongoDB에 연결되었습니다");
  } catch (error) {
    logger.error(`데이터베이스 연결 오류: ${error.message}`);
    process.exit(1);
  }
};

// 서버 시작
const startServer = async () => {
  await connectDB();

  const PORT = 3003;

  app.listen(PORT, () => {
    logger.info(`서버가 포트 ${PORT}에서 실행 중입니다`);
    logger.info(`환경: ${config.NODE_ENV}`);
  });
};

// 앱이 직접 실행될 때만 서버 시작
if (require.main === module) {
  startServer();
}

// 프로세스 종료 처리
process.on("SIGINT", () => {
  logger.info("서버를 종료합니다");
  mongoose.connection.close(() => {
    logger.info("MongoDB 연결이 종료되었습니다");
    process.exit(0);
  });
});

module.exports = app;
