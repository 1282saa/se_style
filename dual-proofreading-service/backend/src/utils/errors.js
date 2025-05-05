/**
 * 기본 API 오류 클래스
 */
class ApiError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 400 Bad Request - 잘못된 요청
 */
class ValidationError extends ApiError {
  constructor(message = "요청 형식이 올바르지 않습니다") {
    super(message, 400);
  }
}

/**
 * 401 Unauthorized - 인증 실패
 */
class AuthenticationError extends ApiError {
  constructor(message = "인증에 실패했습니다") {
    super(message, 401);
  }
}

/**
 * 403 Forbidden - 접근 권한 없음
 */
class ForbiddenError extends ApiError {
  constructor(message = "접근 권한이 없습니다") {
    super(message, 403);
  }
}

/**
 * 404 Not Found - 리소스를 찾을 수 없음
 */
class NotFoundError extends ApiError {
  constructor(message = "요청한 리소스를 찾을 수 없습니다") {
    super(message, 404);
  }
}

/**
 * 409 Conflict - 리소스 충돌
 */
class ConflictError extends ApiError {
  constructor(message = "요청이 현재 리소스 상태와 충돌합니다") {
    super(message, 409);
  }
}

/**
 * 429 Too Many Requests - 요청 제한 초과
 */
class RateLimitError extends ApiError {
  constructor(
    message = "너무 많은 요청을 보냈습니다. 잠시 후 다시 시도해주세요"
  ) {
    super(message, 429);
  }
}

/**
 * 500 Internal Server Error - 서버 내부 오류
 */
class ServerError extends ApiError {
  constructor(message = "서버 내부 오류가 발생했습니다") {
    super(message, 500);
  }
}

/**
 * 502 Bad Gateway - 외부 서비스 연결 오류
 */
class ServiceUnavailableError extends ApiError {
  constructor(message = "외부 서비스 연결에 실패했습니다") {
    super(message, 502);
  }
}

/**
 * 504 Gateway Timeout - 외부 서비스 응답 시간 초과
 */
class ServiceTimeoutError extends ApiError {
  constructor(message = "외부 서비스 응답 시간이 초과되었습니다") {
    super(message, 504);
  }
}

module.exports = {
  ApiError,
  ValidationError,
  AuthenticationError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  ServerError,
  ServiceUnavailableError,
  ServiceTimeoutError,
};
