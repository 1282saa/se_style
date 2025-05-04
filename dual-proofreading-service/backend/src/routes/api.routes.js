/**
 * 일반 API 라우트 정의
 * 빠른 교정 및 선택 저장 등 특정 모델에 종속되지 않는 일반 API
 * @module routes/api
 */

const express = require("express");
const router = express.Router();
const apiController = require("../controllers/api.controller");
const { asyncHandler } = require("../utils/errorHandler");
const { validateRequest } = require("../middlewares/validator");

/**
 * @route POST /api/proofread
 * @description 텍스트를 빠르게 교정하는 엔드포인트
 * @body {string} text - 교정할 텍스트
 * @body {string} [userId] - 사용자 ID (선택 사항)
 * @body {Object} [metadata] - 추가 메타데이터 (선택 사항)
 * @returns {Object} 두 가지 교정 결과 (최소, 향상)와 관련 스타일 가이드
 * @access Public
 */
router.post(
  "/proofread",
  validateRequest({
    body: {
      text: { type: "string", required: true },
      userId: { type: "string", required: false },
      metadata: { type: "object", required: false },
    },
  }),
  asyncHandler(apiController.quickProofread)
);

/**
 * @route GET /api/corrections/:id
 * @description 특정 교정 결과의 상세 내용 조회
 * @param {string} id - 교정 결과 ID
 * @returns {Object} 교정 결과 상세 정보
 * @access Public
 */
router.get(
  "/corrections/:id",
  validateRequest({
    params: {
      id: { type: "mongoId", required: true },
    },
  }),
  asyncHandler(apiController.getCorrectionDetails)
);

/**
 * @route POST /api/choose
 * @description 사용자가 선호하는 교정 결과 선택을 저장
 * @body {string} articleId - 기사 ID
 * @body {string} correctionId - 선택한 교정 결과 ID
 * @body {number} [rating] - 별점 평가 (1-5)
 * @body {string} [comment] - 코멘트
 * @returns {Object} 저장된 선택 정보
 * @access Public
 */
router.post(
  "/choose",
  validateRequest({
    body: {
      articleId: { type: "mongoId", required: true },
      correctionId: { type: "mongoId", required: true },
      rating: { type: "number", min: 1, max: 5, required: false },
      comment: { type: "string", required: false },
    },
  }),
  asyncHandler(apiController.saveUserChoice)
);

/**
 * @route POST /api/proofread/custom
 * @description 사용자 선호도를 반영한 맞춤형 교정 실행
 * @body {string} articleId - 기사 ID
 * @body {Object} preferences - 사용자 선호도 설정
 * @returns {Object} 맞춤형 교정 결과
 * @access Public
 */
router.post(
  "/proofread/custom",
  validateRequest({
    body: {
      articleId: { type: "mongoId", required: true },
      preferences: { type: "object", required: true },
    },
  }),
  asyncHandler(apiController.customProofread)
);

/**
 * @route GET /api/status
 * @description 서비스 상태 확인
 * @returns {Object} 서비스 상태 정보
 * @access Public
 */
router.get("/status", asyncHandler(apiController.getServiceStatus));

/**
 * @route GET /api/docs
 * @description API 문서 접근 엔드포인트
 * @returns {HTML} API 문서 페이지
 * @access Public
 */
router.get("/docs", (req, res) => {
  res.redirect("/docs/index.html");
});

module.exports = router;
