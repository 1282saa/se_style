/**
 * 요청 유효성 검사 미들웨어
 * API 요청의 파라미터, 쿼리, 본문 등의 유효성을 검사합니다.
 * @module middlewares/validator
 */

const { ValidationError } = require("../utils/errorHandler");
const mongoose = require("mongoose");

/**
 * 값이 지정된 타입과 일치하는지 확인합니다.
 * @param {*} value - 검사할 값
 * @param {string} type - 검사할 타입 (string, number, boolean, object, array, mongoId)
 * @returns {boolean} - 유효성 여부
 */
const isValidType = (value, type) => {
  if (value === undefined || value === null) {
    return false;
  }

  switch (type) {
    case "string":
      return typeof value === "string";
    case "number":
      return typeof value === "number" && !isNaN(value);
    case "boolean":
      return typeof value === "boolean";
    case "object":
      return (
        typeof value === "object" && !Array.isArray(value) && value !== null
      );
    case "array":
      return Array.isArray(value);
    case "mongoId":
      return mongoose.Types.ObjectId.isValid(value);
    default:
      return true;
  }
};

/**
 * 값이 지정된 최소/최대 범위 내에 있는지 확인합니다.
 * @param {*} value - 검사할 값
 * @param {object} schema - 검사 스키마
 * @returns {boolean} - 유효성 여부
 */
const isInRange = (value, schema) => {
  if (typeof value === "number") {
    if (schema.min !== undefined && value < schema.min) {
      return false;
    }
    if (schema.max !== undefined && value > schema.max) {
      return false;
    }
  }
  if (typeof value === "string" || Array.isArray(value)) {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      return false;
    }
    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      return false;
    }
  }
  return true;
};

/**
 * 요청 유효성 검사 미들웨어를 생성합니다.
 * @param {object} schema - 검사 스키마 정의
 * @returns {function} - Express 미들웨어 함수
 */
const validateRequest = (schema) => {
  return (req, res, next) => {
    try {
      // 1. params 검사
      if (schema.params) {
        for (const [param, rules] of Object.entries(schema.params)) {
          const value = req.params[param];

          // 필수 필드 검사
          if (rules.required && (value === undefined || value === null)) {
            throw new ValidationError(`URL 파라미터 '${param}'가 필요합니다.`);
          }

          // 타입 검사
          if (
            value !== undefined &&
            value !== null &&
            rules.type &&
            !isValidType(value, rules.type)
          ) {
            throw new ValidationError(
              `URL 파라미터 '${param}'의 형식이 올바르지 않습니다.`
            );
          }

          // 범위 검사
          if (
            value !== undefined &&
            value !== null &&
            !isInRange(value, rules)
          ) {
            throw new ValidationError(
              `URL 파라미터 '${param}'의 값이 허용 범위를 벗어났습니다.`
            );
          }
        }
      }

      // 2. query 검사
      if (schema.query) {
        for (const [param, rules] of Object.entries(schema.query)) {
          const value = req.query[param];

          // 필수 필드 검사
          if (rules.required && (value === undefined || value === null)) {
            throw new ValidationError(`쿼리 파라미터 '${param}'가 필요합니다.`);
          }

          // 타입 검사
          if (
            value !== undefined &&
            value !== null &&
            rules.type &&
            !isValidType(value, rules.type)
          ) {
            throw new ValidationError(
              `쿼리 파라미터 '${param}'의 형식이 올바르지 않습니다.`
            );
          }

          // 범위 검사
          if (
            value !== undefined &&
            value !== null &&
            !isInRange(value, rules)
          ) {
            throw new ValidationError(
              `쿼리 파라미터 '${param}'의 값이 허용 범위를 벗어났습니다.`
            );
          }
        }
      }

      // 3. body 검사
      if (schema.body) {
        for (const [field, rules] of Object.entries(schema.body)) {
          const value = req.body[field];

          // 필수 필드 검사
          if (rules.required && (value === undefined || value === null)) {
            throw new ValidationError(
              `요청 본문 '${field}' 필드가 필요합니다.`
            );
          }

          // 타입 검사
          if (
            value !== undefined &&
            value !== null &&
            rules.type &&
            !isValidType(value, rules.type)
          ) {
            throw new ValidationError(
              `요청 본문 '${field}' 필드의 형식이 올바르지 않습니다.`
            );
          }

          // 범위 검사
          if (
            value !== undefined &&
            value !== null &&
            !isInRange(value, rules)
          ) {
            throw new ValidationError(
              `요청 본문 '${field}' 필드의 값이 허용 범위를 벗어났습니다.`
            );
          }
        }
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

module.exports = {
  validateRequest,
};
