const { ValidationError } = require("../utils/errors");

/**
 * Joi 스키마를 사용하여 요청을 검증하는 미들웨어
 * @param {Object} schema - Joi 스키마
 * @returns {Function} - Express 미들웨어
 */
const validateSchema = (schema) => (req, res, next) => {
  try {
    // 스키마 검증
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    // 검증 오류 처리
    if (error) {
      const errorMessage = error.details
        .map((detail) => detail.message)
        .join(", ");
      return res.status(400).json({
        success: false,
        message: "요청 형식이 올바르지 않습니다",
        errors: errorMessage,
      });
    }

    // 검증된 값으로 req.body 대체
    req.body = value;
    next();
  } catch (err) {
    next(new ValidationError("요청 검증 중 오류가 발생했습니다"));
  }
};

module.exports = {
  validateSchema,
};
