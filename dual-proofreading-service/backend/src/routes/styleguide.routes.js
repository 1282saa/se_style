/**
 * 스타일 가이드 API 라우트 정의
 * 교정 규칙 및 스타일 가이드 관리를 위한 엔드포인트
 * @module routes/styleguide
 */

const express = require("express");
const router = express.Router();
const styleguideController = require("../controllers/styleguide.controller");
const { asyncHandler } = require("../utils/errorHandler");
const { validateRequest } = require("../middlewares/validator");

/**
 * @route GET /api/styleguides
 * @description 스타일 가이드 목록 조회
 * @query {string} [category] - 필터링할 카테고리
 * @query {string} [tag] - 필터링할 태그
 * @query {string} [search] - 검색어
 * @query {number} [page=1] - 페이지 번호
 * @query {number} [limit=20] - 페이지당 항목 수
 * @returns {Array} 스타일 가이드 목록
 * @access Public
 */
router.get(
  "/",
  validateRequest({
    query: {
      category: { type: "string", required: false },
      tag: { type: "string", required: false },
      search: { type: "string", required: false },
      page: { type: "number", min: 1, required: false },
      limit: { type: "number", min: 1, max: 100, required: false },
    },
  }),
  asyncHandler(styleguideController.getStyleguides)
);

/**
 * @route GET /api/styleguides/:id
 * @description 특정 스타일 가이드 조회
 * @param {string} id - 스타일 가이드 ID
 * @returns {Object} 스타일 가이드 상세 정보
 * @access Public
 */
router.get(
  "/:id",
  validateRequest({
    params: {
      id: { type: "mongoId", required: true },
    },
  }),
  asyncHandler(styleguideController.getStyleguideById)
);

/**
 * @route POST /api/styleguides
 * @description 새 스타일 가이드 생성
 * @body {string} section - 섹션 이름
 * @body {string} content - 내용
 * @body {string} category - 카테고리
 * @body {Array} [tags] - 태그 목록
 * @body {number} [priority] - 우선순위
 * @returns {Object} 생성된 스타일 가이드
 * @access Public
 */
router.post(
  "/",
  validateRequest({
    body: {
      section: { type: "string", required: true },
      content: { type: "string", required: true },
      category: { type: "string", required: true },
      tags: { type: "array", required: false },
      priority: { type: "number", min: 1, max: 5, required: false },
    },
  }),
  asyncHandler(styleguideController.createStyleguide)
);

/**
 * @route PUT /api/styleguides/:id
 * @description 스타일 가이드 업데이트
 * @param {string} id - 스타일 가이드 ID
 * @body {Object} styleguide - 업데이트할 스타일 가이드 필드
 * @returns {Object} 업데이트된 스타일 가이드
 * @access Public
 */
router.put(
  "/:id",
  validateRequest({
    params: {
      id: { type: "mongoId", required: true },
    },
    body: {
      section: { type: "string", required: false },
      content: { type: "string", required: false },
      category: { type: "string", required: false },
      tags: { type: "array", required: false },
      priority: { type: "number", min: 1, max: 5, required: false },
    },
  }),
  asyncHandler(styleguideController.updateStyleguide)
);

/**
 * @route DELETE /api/styleguides/:id
 * @description 스타일 가이드 삭제
 * @param {string} id - 스타일 가이드 ID
 * @returns {Object} 삭제 결과
 * @access Public
 */
router.delete(
  "/:id",
  validateRequest({
    params: {
      id: { type: "mongoId", required: true },
    },
  }),
  asyncHandler(styleguideController.deleteStyleguide)
);

/**
 * @route GET /api/styleguides/categories
 * @description 스타일 가이드 카테고리 목록 조회
 * @returns {Array} 카테고리 목록
 * @access Public
 */
router.get("/categories", asyncHandler(styleguideController.getCategories));

/**
 * @route GET /api/styleguides/tags
 * @description 스타일 가이드 태그 목록 조회
 * @returns {Array} 태그 목록
 * @access Public
 */
router.get("/tags", asyncHandler(styleguideController.getTags));

/**
 * @route POST /api/styleguides/search
 * @description 관련 스타일 가이드 검색
 * @body {string} text - 검색할 텍스트
 * @body {number} [limit=5] - 결과 수 제한
 * @returns {Array} 관련 스타일 가이드 목록
 * @access Public
 */
router.post(
  "/search",
  validateRequest({
    body: {
      text: { type: "string", required: true },
      limit: { type: "number", min: 1, max: 50, required: false },
    },
  }),
  asyncHandler(styleguideController.searchRelatedStyleguides)
);

/**
 * @route GET /api/styleguides/related/:id
 * @description 관련 스타일 가이드 조회
 * @param {string} id - 스타일 가이드 ID
 * @query {number} [limit=3] - 결과 수 제한
 * @returns {Array} 관련 스타일 가이드 목록
 * @access Public
 */
router.get(
  "/related/:id",
  validateRequest({
    params: {
      id: { type: "mongoId", required: true },
    },
    query: {
      limit: { type: "number", min: 1, max: 20, required: false },
    },
  }),
  asyncHandler(styleguideController.getRelatedStyleguides)
);

/**
 * @route POST /api/styleguides/import
 * @description 스타일 북 가져오기
 * @body {Array} data - 가져올 스타일 북 데이터
 * @returns {Object} 가져오기 결과
 * @access Public
 */
router.post(
  "/import",
  validateRequest({
    body: {
      data: { type: "array", required: true },
    },
  }),
  asyncHandler(styleguideController.importStylebook)
);

/**
 * @route POST /api/styleguides/generate-embeddings
 * @description 스타일 가이드 임베딩 생성
 * @body {boolean} [forceUpdate=false] - 기존 임베딩도 업데이트할지 여부
 * @returns {Object} 생성 결과
 * @access Public
 */
router.post(
  "/generate-embeddings",
  validateRequest({
    body: {
      forceUpdate: { type: "boolean", required: false },
    },
  }),
  asyncHandler(styleguideController.generateEmbeddings)
);

/**
 * @route POST /api/styleguides/test-vector-search
 * @description 벡터 검색 테스트
 * @body {string} text - 검색 텍스트
 * @body {number} [limit=5] - 결과 수 제한
 * @returns {Array} 검색 결과
 * @access Public
 */
router.post(
  "/test-vector-search",
  validateRequest({
    body: {
      text: { type: "string", required: true },
      limit: { type: "number", min: 1, max: 50, required: false },
    },
  }),
  asyncHandler(styleguideController.testVectorSearch)
);

module.exports = router;
