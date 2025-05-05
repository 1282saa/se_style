const logger = require("./logger");
const { AppError } = require("./error");

/* 전역 오류 미들웨어 */
module.exports = (err, req, res, next) => {
  if (!(err instanceof AppError)) {
    logger.error(err.stack || err.message);
    err = new AppError("INTERNAL_ERROR", 500, "서버 오류가 발생했습니다");
  }
  res
    .status(err.status)
    .json({ success: false, code: err.code, message: err.message });
};
