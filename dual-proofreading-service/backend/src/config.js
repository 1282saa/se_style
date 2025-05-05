require("dotenv").config();
const path = require("path");

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
};

module.exports = config;
