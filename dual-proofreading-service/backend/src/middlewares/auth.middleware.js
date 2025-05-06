const jwt = require("jsonwebtoken");
const logger = require("../utils/logger");

/**
 * JWT 인증 미들웨어
 * 요청 헤더의 Authorization 토큰을 검증합니다.
 */
const authenticateJWT = (req, res, next) => {
  // 1. 개발 모드에서는 인증 생략 (옵션)
  if (
    process.env.NODE_ENV === "development" &&
    process.env.BYPASS_AUTH === "true"
  ) {
    logger.warn("개발 모드: 인증 생략");
    req.user = { id: "dev-user", role: "admin" };
    return next();
  }

  // 2. Authorization 헤더 확인
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    logger.warn("인증 토큰 없음");
    return res.status(401).json({
      success: false,
      message: "인증이 필요합니다",
    });
  }

  // 3. 토큰 추출
  const token = authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({
      success: false,
      message: "유효하지 않은 인증 형식입니다",
    });
  }

  try {
    // 4. JWT 검증
    const secretKey = process.env.JWT_SECRET || "default-secret-key";
    const decoded = jwt.verify(token, secretKey);

    // 5. 요청 객체에 사용자 정보 추가
    req.user = decoded;

    // 다음 미들웨어로 이동
    next();
  } catch (error) {
    logger.error(`토큰 검증 오류: ${error.message}`);

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "인증 토큰이 만료되었습니다",
      });
    }

    return res.status(401).json({
      success: false,
      message: "유효하지 않은 인증 토큰입니다",
    });
  }
};

/**
 * 관리자 권한 확인 미들웨어
 * 인증된 사용자의 관리자 권한을 확인합니다.
 */
const adminMiddleware = (req, res, next) => {
  // 사용자 정보 확인
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "인증이 필요합니다",
    });
  }

  // 관리자 권한 확인
  if (req.user.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "관리자 권한이 필요합니다",
    });
  }

  // 관리자 권한 확인됨, 다음 미들웨어로 이동
  next();
};

module.exports = {
  authenticateJWT,
  adminMiddleware,
};
