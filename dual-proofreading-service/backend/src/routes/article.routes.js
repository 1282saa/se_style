/**
 * 기사 관리 API 라우트 정의
 * 기사 등록, 조회, 교정 요청에 대한 엔드포인트
 * @module routes/article
 */

const express = require("express");
const router = express.Router();
const articleController = require("../controllers/article.controller");
const { asyncHandler } = require("../utils/errorHandler");
const { validateRequest } = require("../middlewares/validator");

/**
 * @route POST /api/articles
 * @description 새 기사 등록
 * @body {string} originalText - 원본 기사 텍스트
 * @body {string} [userId] - 사용자 ID (선택)
 * @body {string} [topic] - 기사 주제 (선택)
 * @body {string} [category] - 기사 카테고리 (선택)
 * @returns {Object} 생성된 기사 정보
 * @access Public
 */
router.post(
  "/",
  validateRequest({
    body: {
      originalText: { type: "string", required: true },
      userId: { type: "string", required: false },
      topic: { type: "string", required: false },
      category: { type: "string", required: false },
    },
  }),
  asyncHandler(articleController.createArticle)
);

/**
 * @route GET /api/articles
 * @description 사용자 기사 목록 조회
 * @query {string} userId - 사용자 ID
 * @query {number} [page=1] - 페이지 번호
 * @query {number} [limit=10] - 페이지당 항목 수
 * @returns {Object} 기사 목록 및 페이지네이션 정보
 * @access Public
 */
router.get(
  "/",
  validateRequest({
    query: {
      userId: { type: "string", required: true },
      page: { type: "number", min: 1, required: false },
      limit: { type: "number", min: 1, max: 100, required: false },
    },
  }),
  asyncHandler(articleController.getUserArticles)
);

/**
 * @route GET /api/articles/:id
 * @description 특정 기사 상세 조회
 * @param {string} id - 기사 ID
 * @returns {Object} 기사 상세 정보
 * @access Public
 */
router.get(
  "/:id",
  validateRequest({
    params: {
      id: { type: "mongoId", required: true },
    },
  }),
  asyncHandler(articleController.getArticleById)
);

/**
 * @route POST /api/articles/quick-proofread
 * @description 빠른 기사 교정 요청
 * @body {string} text - 교정할 기사 텍스트
 * @body {string} [userId] - 사용자 ID (선택)
 * @returns {Object} 교정 결과
 * @access Public
 */
router.post(
  "/quick-proofread",
  validateRequest({
    body: {
      text: { type: "string", required: true },
      userId: { type: "string", required: false },
    },
  }),
  asyncHandler(articleController.quickProofread)
);

/**
 * @route POST /api/articles/:id/proofread
 * @description 특정 기사 교정 요청
 * @param {string} id - 기사 ID
 * @body {Object} [preferences] - 교정 환경설정
 * @returns {Object} 교정 결과
 * @access Public
 */
router.post(
  "/:id/proofread",
  validateRequest({
    params: {
      id: { type: "mongoId", required: true },
    },
    body: {
      preferences: { type: "object", required: false },
    },
  }),
  asyncHandler(articleController.proofreadArticle)
);

/**
 * @route GET /api/articles/:id/corrections
 * @description 기사의 모든 교정 결과 조회
 * @param {string} id - 기사 ID
 * @returns {Array} 교정 결과 목록
 * @access Public
 */
router.get(
  "/:id/corrections",
  validateRequest({
    params: {
      id: { type: "mongoId", required: true },
    },
  }),
  asyncHandler(articleController.getArticleCorrections)
);

/**
 * @route GET /api/articles/:id/user-choices
 * @description 기사에 대한 사용자 선택 조회
 * @param {string} id - 기사 ID
 * @returns {Array} 사용자 선택 목록
 * @access Public
 */
router.get(
  "/:id/user-choices",
  validateRequest({
    params: {
      id: { type: "mongoId", required: true },
    },
  }),
  asyncHandler(articleController.getArticleUserChoices)
);

/**
 * @route POST /api/articles/:id/choose
 * @description 교정 결과에 대한 사용자 선택 저장
 * @param {string} id - 기사 ID
 * @body {string} correctionId - 선택한 교정 결과 ID
 * @body {number} [rating] - 평가 점수 (1-5)
 * @body {string} [comment] - 사용자 의견
 * @returns {Object} 저장된 선택 정보
 * @access Public
 */
router.post(
  "/:id/choose",
  validateRequest({
    params: {
      id: { type: "mongoId", required: true },
    },
    body: {
      correctionId: { type: "mongoId", required: true },
      rating: { type: "number", min: 1, max: 5, required: false },
      comment: { type: "string", required: false },
    },
  }),
  asyncHandler(articleController.saveUserChoice)
);

module.exports = router;
