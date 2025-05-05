const jwt = require("jsonwebtoken");
const { AuthenticationError } = require("../utils/errors");
const logger = require("../utils/logger");
const config = require("../config");

/**
 * JWT 토큰을 검증하는 인증 미들웨어
 * @param {Object} req - Express 요청 객체
 * @param {Object} res - Express 응답 객체
 * @param {Function} next - Express 다음 미들웨어 함수
 */
const authenticate = (req, res, next) => {
  try {
    // 헤더에서 토큰 추출
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "인증이 필요합니다",
      });
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "유효한 토큰이 제공되지 않았습니다",
      });
    }

    // 토큰 검증
    const decoded = jwt.verify(token, config.JWT_SECRET);

    // 요청 객체에 사용자 정보 추가
    req.user = decoded;

    next();
  } catch (error) {
    logger.error(`인증 오류: ${error.message}`);

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "토큰이 만료되었습니다",
      });
    }

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "유효하지 않은 토큰입니다",
      });
    }

    next(new AuthenticationError("인증 처리 중 오류가 발생했습니다"));
  }
};

/**
 * 개발 환경에서 사용하는 간단한 인증 미들웨어
 * (실제 프로덕션 환경에서는 사용하지 않음)
 */
const devAuthenticate = (req, res, next) => {
  // 개발 환경에서만 사용
  if (process.env.NODE_ENV !== "development") {
    return authenticate(req, res, next);
  }

  // X-API-Key 헤더 확인
  const apiKey = req.headers["x-api-key"];

  if (apiKey === config.DEV_API_KEY) {
    // 개발용 사용자 정보 추가
    req.user = {
      id: "dev-user",
      role: "admin",
      name: "Developer",
    };
    return next();
  }

  // API 키가 없는 경우 일반 인증 시도
  authenticate(req, res, next);
};

module.exports = {
  authenticate,
  devAuthenticate,
};
