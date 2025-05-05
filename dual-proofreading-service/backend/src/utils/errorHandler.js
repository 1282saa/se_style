/**
 * 오류 처리 유틸리티
 * 애플리케이션 전반에서 발생하는 오류 처리 기능을 제공합니다.
 * @module utils/errorHandler
 */

const { ApiError } = require("./errors");
const logger = require("./logger");

/**
 * API 오류 처리 미들웨어
 * @param {Error} err - 발생한 오류
 * @param {Object} req - Express 요청 객체
 * @param {Object} res - Express 응답 객체
 * @param {Function} next - Express 다음 미들웨어 함수
 */
const errorHandler = (err, req, res, next) => {
  // 이미 응답이 전송된 경우
  if (res.headersSent) {
    return next(err);
  }

  let statusCode = 500;
  let message = "서버 내부 오류가 발생했습니다";
  let errorDetails = null;

  // API 오류인 경우
  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    message = err.message;
  } else if (err.name === "ValidationError" && err.errors) {
    // Mongoose 검증 오류
    statusCode = 400;
    message = "데이터 유효성 검증에 실패했습니다";
    errorDetails = Object.values(err.errors).map((e) => e.message);
  } else if (err.name === "MongoServerError" && err.code === 11000) {
    // MongoDB 중복 키 오류
    statusCode = 409;
    message = "이미 존재하는 데이터입니다";
  } else if (err.name === "SyntaxError" && err.status === 400) {
    // JSON 파싱 오류
    statusCode = 400;
    message = "잘못된 JSON 형식입니다";
  } else if (err.name === "TokenExpiredError") {
    // JWT 토큰 만료
    statusCode = 401;
    message = "인증 토큰이 만료되었습니다";
  } else if (err.name === "JsonWebTokenError") {
    // JWT 토큰 오류
    statusCode = 401;
    message = "유효하지 않은 인증 토큰입니다";
  }

  // 개발 환경에서는 상세 오류 표시
  if (process.env.NODE_ENV === "development") {
    errorDetails = errorDetails || err.stack;
  }

  // 오류 로깅
  const logMethod = statusCode >= 500 ? logger.error : logger.warn;
  logMethod(`[${statusCode}] ${message}`, {
    path: req.path,
    method: req.method,
    ip: req.ip,
    error: err.message,
    stack: err.stack,
  });

  // 응답 전송
  res.status(statusCode).json({
    success: false,
    message,
    ...(errorDetails &&
      process.env.NODE_ENV === "development" && { error: errorDetails }),
  });
};

/**
 * 비동기 라우트 핸들러 래퍼
 * @param {Function} fn - 비동기 라우트 핸들러
 * @returns {Function} - 오류 처리가 포함된 라우트 핸들러
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * 사용자 정의 오류 클래스
 * 애플리케이션에서 사용하는 기본 오류 클래스
 * @extends Error
 */
class AppError extends Error {
  /**
   * 사용자 정의 오류 생성
   * @param {string} message - 오류 메시지
   * @param {number} statusCode - HTTP 상태 코드
   */
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 요청 검증 오류
 * 클라이언트 요청 데이터가 유효하지 않을 때 사용
 * @extends AppError
 */
class ValidationError extends AppError {
  /**
   * 검증 오류 생성
   * @param {string} message - 오류 메시지 (기본값: "입력 데이터가 유효하지 않습니다.")
   */
  constructor(message = "입력 데이터가 유효하지 않습니다.") {
    super(message, 400);
  }
}

/**
 * 리소스 찾을 수 없음 오류
 * 요청한 리소스가 존재하지 않을 때 사용
 * @extends AppError
 */
class NotFoundError extends AppError {
  /**
   * 리소스 없음 오류 생성
   * @param {string} message - 오류 메시지 (기본값: "요청한 리소스를 찾을 수 없습니다.")
   */
  constructor(message = "요청한 리소스를 찾을 수 없습니다.") {
    super(message, 404);
  }
}

/**
 * 권한 부족 오류
 * 인증되지 않은 요청이나 권한 부족 시 사용
 * @extends AppError
 */
class UnauthorizedError extends AppError {
  /**
   * 권한 부족 오류 생성
   * @param {string} message - 오류 메시지 (기본값: "이 작업을 수행할 권한이 없습니다.")
   */
  constructor(message = "이 작업을 수행할 권한이 없습니다.") {
    super(message, 401);
  }
}

/**
 * 중복 데이터 오류
 * 이미 존재하는 데이터를 다시 생성하려 할 때 사용
 * @extends AppError
 */
class DuplicateError extends AppError {
  /**
   * 중복 데이터 오류 생성
   * @param {string} message - 오류 메시지 (기본값: "이미 존재하는 데이터입니다.")
   */
  constructor(message = "이미 존재하는 데이터입니다.") {
    super(message, 409);
  }
}

/**
 * 서비스 사용 불가 오류
 * 외부 서비스 연결 실패 등 서비스 이용 불가 시 사용
 * @extends AppError
 */
class ServiceUnavailableError extends AppError {
  /**
   * 서비스 불가 오류 생성
   * @param {string} message - 오류 메시지 (기본값: "서비스를 일시적으로 사용할 수 없습니다.")
   */
  constructor(message = "서비스를 일시적으로 사용할 수 없습니다.") {
    super(message, 503);
  }
}

module.exports = {
  errorHandler,
  asyncHandler,
  AppError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  DuplicateError,
  ServiceUnavailableError,
};
