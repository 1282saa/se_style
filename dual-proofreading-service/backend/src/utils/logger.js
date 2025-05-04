// src/utils/logger.js
const winston = require("winston");
require("winston-daily-rotate-file");
const path = require("path");
const fs = require("fs");

// 로그 디렉토리 생성
const logDir = path.join(process.cwd(), "logs");
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// 로그 포맷 정의
const logFormat = winston.format.printf(
  ({ level, message, timestamp, ...meta }) => {
    let metaStr = "";
    if (Object.keys(meta).length > 0) {
      metaStr = JSON.stringify(meta);
    }
    return `${timestamp} [${level.toUpperCase()}] ${message} ${metaStr}`;
  }
);

// 로거 설정
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.errors({ stack: true }),
    logFormat
  ),
  transports: [
    // 콘솔 출력 설정
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        logFormat
      ),
    }),

    // 파일 출력 설정 (일별 로그 파일)
    new winston.transports.DailyRotateFile({
      filename: path.join(logDir, "application-%DATE%.log"),
      datePattern: "YYYY-MM-DD",
      zippedArchive: true,
      maxSize: "20m",
      maxFiles: "14d",
    }),

    // 에러 로그 파일 설정
    new winston.transports.DailyRotateFile({
      filename: path.join(logDir, "error-%DATE%.log"),
      datePattern: "YYYY-MM-DD",
      level: "error",
      zippedArchive: true,
      maxSize: "20m",
      maxFiles: "14d",
    }),
  ],
});

// 개발 환경에서는 상세 로깅
if (process.env.NODE_ENV === "development") {
  logger.debug("로거가 개발 모드로 초기화되었습니다");
}

module.exports = logger;
