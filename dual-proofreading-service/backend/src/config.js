const dotenv = require("dotenv");
const path = require("path");
const fs = require("fs");

// 환경변수 로드 함수
const loadEnvVariables = () => {
  const envPath = path.resolve(__dirname, "../.env");

  if (fs.existsSync(envPath)) {
    console.log(`.env 파일을 찾았습니다: ${envPath}`);
    dotenv.config({ path: envPath });
  } else {
    console.log(".env 파일을 찾을 수 없습니다.");
    // 기본 .env 로드 시도
    dotenv.config();
  }

  // 환경 변수 확인 및 로깅
  const keysToCheck = [
    "ANTHROPIC_API_KEY",
    "CLAUDE_MODEL",
    "THREAD_ACCESS_TOKEN",
    "THREAD_USER_ID",
    "INSTAGRAM_ACCESS_TOKEN",
  ];

  for (const key of keysToCheck) {
    if (process.env[key]) {
      const valuePreview =
        key.includes("TOKEN") || key.includes("KEY")
          ? `설정됨 (${process.env[key].substring(0, 5)}...)`
          : process.env[key];
      console.log(`${key}: ${valuePreview}`);
    } else {
      console.log(`${key}: 설정되지 않음`);
    }
  }
};

// 환경변수 로드
loadEnvVariables();

const config = {
  // 서버 설정
  PORT: process.env.PORT || 3003,
  NODE_ENV: process.env.NODE_ENV || "development",
  LOG_LEVEL: process.env.LOG_LEVEL || "info",

  // MongoDB 설정
  MONGODB_URI:
    process.env.MONGODB_URI || "mongodb://localhost:27017/proofreading-service",

  // Anthropic API 설정
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  CLAUDE_MODEL: process.env.CLAUDE_MODEL || "claude-3-opus-20240229",
  EMBEDDING_MODEL: process.env.EMBEDDING_MODEL || "claude-3-sonnet-20240229",

  // 스타일북 설정
  STYLE_BOOK_DIR:
    process.env.STYLE_BOOK_DIR || path.join(__dirname, "../data/stylebook"),

  // CORS 설정
  CORS_ORIGIN: process.env.CORS_ORIGIN || "http://localhost:3000",

  // 토큰 제한
  TOKEN_LIMIT: parseInt(process.env.TOKEN_LIMIT || 16000, 10),

  // JWT 설정
  JWT_SECRET: process.env.JWT_SECRET || "your-secret-key-for-development-only",
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "24h",

  // 개발 환경 API 키
  DEV_API_KEY: process.env.DEV_API_KEY || "dev-api-key-for-testing",

  // 소셜 미디어 설정
  THREAD_ACCESS_TOKEN: process.env.THREAD_ACCESS_TOKEN,
  THREAD_USER_ID: process.env.THREAD_USER_ID,
  INSTAGRAM_ACCESS_TOKEN: process.env.INSTAGRAM_ACCESS_TOKEN,

  // 비율 제한 설정
  RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX || 120, 10),
};

module.exports = config;
