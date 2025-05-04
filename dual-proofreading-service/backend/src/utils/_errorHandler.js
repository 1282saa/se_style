/**
 * 오류 처리 유틸리티
 * 애플리케이션 전반에서 발생하는 오류 처리 기능을 제공합니다.
 * @module utils/errorHandler
 */

const logger = require("./logger");

/**
 * API 응답 형식의 오류 객체를 생성합니다.
 * @param {Error} error - 오류 객체
 * @param {number} statusCode - HTTP 상태 코드 (기본값: 500)
 * @returns {Object} - 응답 형식의 오류 객체
 */
const formatError = (error, statusCode = 500) => {
  // 오류 로깅
  logger.error(`오류 발생: ${error.message}`);
  if (error.stack) {
    logger.debug(`스택 트레이스: ${error.stack}`);
  }

  // 오류 응답 형식
  return {
    success: false,
    statusCode,
    message: error.message || "서버 내부 오류가 발생했습니다.",
    error: process.env.NODE_ENV === "development" ? error.stack : undefined,
  };
};

/**
 * 비동기 함수에 대한 오류 처리 래퍼
 * @param {Function} fn - 비동기 컨트롤러 함수
 * @returns {Function} - 오류 처리가 추가된 래퍼 함수
 */
const asyncHandler = (fn) => {
  return async (req, res, next) => {
    try {
      await fn(req, res, next);
    } catch (error) {
      const formattedError = formatError(error);
      res.status(formattedError.statusCode || 500).json(formattedError);
    }
  };
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
  asyncHandler,
  formatError,
  AppError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  DuplicateError,
  ServiceUnavailableError,
};
