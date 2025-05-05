const express = require("express");
const router = express.Router();
const socialController = require("../controllers/social.controller");
const { asyncHandler } = require("../utils/errorHandler");
const { validateRequest } = require("../middlewares/validator");
const { authenticateJWT } = require("../middlewares/auth.middleware");

/**
 * @route GET /api/social/accounts
 * @description 사용자의 연결된 소셜 미디어 계정 목록 조회
 * @access Public
 */
router.get("/accounts", asyncHandler(socialController.getConnectedAccounts));

/**
 * @route POST /api/social/connect/:platform
 * @description 소셜 미디어 계정 연결
 * @body {Object} credentials - 인증 정보
 * @access Public
 */
router.post(
  "/connect/:platform",
  validateRequest({
    params: {
      platform: {
        type: "string",
        enum: ["instagram", "facebook", "twitter", "thread", "linkedin"],
        required: true,
      },
    },
    body: {
      accessToken: { type: "string", required: true },
      refreshToken: { type: "string", required: false },
      platformUserId: { type: "string", required: true },
      username: { type: "string", required: false },
    },
  }),
  asyncHandler(socialController.connectAccount)
);

/**
 * @route POST /api/social/generate
 * @description 소셜 미디어 게시물 생성
 * @body {string} articleId - 기사 ID
 * @body {string} platform - 소셜 미디어 플랫폼
 * @body {string} [correctionId] - 교정 결과 ID
 * @body {Object} [options] - 추가 옵션
 * @access Public
 */
router.post(
  "/generate",
  validateRequest({
    body: {
      articleId: { type: "mongoId", required: true },
      platform: {
        type: "string",
        enum: ["instagram", "facebook", "twitter", "thread", "linkedin"],
        required: true,
      },
      correctionId: { type: "mongoId", required: false },
      options: { type: "object", required: false },
    },
  }),
  asyncHandler(socialController.generatePost)
);

/**
 * @route POST /api/social/publish/:postId
 * @description 생성된 게시물을 소셜 미디어에 게시
 * @access Public
 */
router.post(
  "/publish/:postId",
  validateRequest({
    params: {
      postId: { type: "mongoId", required: true },
    },
  }),
  asyncHandler(socialController.publishPost)
);

/**
 * @route GET /api/social/posts
 * @description 사용자의 소셜 미디어 포스트 목록 조회
 * @access Public
 */
router.get("/posts", asyncHandler(socialController.getUserPosts));

/**
 * @route GET /api/social/statistics
 * @description 소셜 미디어 통계 조회
 * @query {string} platform - 소셜 미디어 플랫폼
 * @query {string} [userId] - 사용자 ID
 * @access Public
 */
router.get(
  "/statistics",
  validateRequest({
    query: {
      platform: {
        type: "string",
        enum: ["instagram", "facebook", "twitter", "thread", "linkedin"],
        required: true,
      },
      userId: { type: "string", required: false },
    },
  }),
  asyncHandler(socialController.getSocialMediaStatistics)
);

// 모든 소셜 미디어 API는 인증이 필요합니다
router.use(authenticateJWT);

module.exports = router;
