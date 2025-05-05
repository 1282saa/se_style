// src/config/index.js
const dotenv = require("dotenv");
dotenv.config();

// 환경 변수 설정
const config = {
  // 서버 설정
  PORT: process.env.PORT || 3003,
  NODE_ENV: process.env.NODE_ENV || "development",
  MONGODB_URI:
    process.env.MONGODB_URI || "mongodb://localhost:27017/proofreading",

  // Claude API 설정
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  CLAUDE_MODEL: process.env.CLAUDE_MODEL || "claude-3-opus-20240229",
  EMBEDDING_MODEL: process.env.EMBEDDING_MODEL || "claude-3-sonnet-20240229",
  ANTHROPIC_MAX_TOKENS: parseInt(
    process.env.ANTHROPIC_MAX_TOKENS || "4000",
    10
  ),

  // 서비스 설정
  MAX_TEXT_LENGTH: parseInt(process.env.MAX_TEXT_LENGTH || "10000", 10),
  MAX_STYLE_GUIDE_LENGTH: parseInt(
    process.env.MAX_STYLE_GUIDE_LENGTH || "2000",
    10
  ),

  // 캐싱 설정
  REDIS_URL: process.env.REDIS_URL || "",
  CACHE_TTL: parseInt(process.env.CACHE_TTL || "3600", 10),

  // CORS 설정
  CORS_ORIGIN: process.env.CORS_ORIGIN || "*",

  // 토큰 제한
  TOKEN_LIMIT: parseInt(process.env.TOKEN_LIMIT || "16000", 10),

  // 스타일북 설정
  STYLE_BOOK_DIR: process.env.STYLE_BOOK_DIR || "./data/stylebook",

  // 로깅 설정
  LOG_LEVEL: process.env.LOG_LEVEL || "info",

  // 속도 제한
  RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX || "120", 10),

  // 개발 설정
  USE_MOCK_EMBEDDINGS: process.env.USE_MOCK_EMBEDDINGS === "true" || false,
};

// 환경 변수 확인 및 오류 방지
Object.entries(config).forEach(([key, value]) => {
  if (value === undefined) {
    console.warn(`경고: 설정 키 ${key}가 정의되지 않았습니다`);
  }
});

module.exports = config;
