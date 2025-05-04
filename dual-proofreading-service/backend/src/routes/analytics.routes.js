/**
 * 분석 API 라우트 정의
 * 사용자 선호도, 교정 통계 등 분석 데이터 관련 엔드포인트
 * @module routes/analytics
 */

const express = require("express");
const router = express.Router();
const analyticsController = require("../controllers/analytics.controller");
const { asyncHandler } = require("../utils/errorHandler");

/**
 * @route GET /api/analytics/user-preferences/:userId
 * @description 특정 사용자의 교정 선호도 조회
 * @param {string} userId - 사용자 ID
 * @returns {Object} 사용자 선호도 분석 데이터
 * @access Public
 */
router.get(
  "/user-preferences/:userId",
  asyncHandler(analyticsController.getUserPreferences)
);

/**
 * @route GET /api/analytics/stats
 * @description 서비스 전체 통계 조회
 * @query {string} [period=all] - 통계 기간 (day, week, month, all)
 * @returns {Object} 교정 요청 수, 완료 수, 평균 처리 시간 등
 * @access Public
 */
router.get("/stats", asyncHandler(analyticsController.getServiceStats));

/**
 * @route GET /api/analytics/correction-time
 * @description 교정 처리 시간 통계 조회
 * @query {string} [period=month] - 통계 기간 (day, week, month, year)
 * @returns {Object} 시간대별, 기간별 교정 처리 시간 통계
 * @access Public
 */
router.get(
  "/correction-time",
  asyncHandler(analyticsController.getCorrectionTimeStats)
);

/**
 * @route GET /api/analytics/common-corrections
 * @description 자주 발생하는 교정 유형 분석
 * @query {number} [limit=10] - 반환할 결과 수
 * @returns {Array} 빈도별 교정 유형 목록
 * @access Public
 */
router.get(
  "/common-corrections",
  asyncHandler(analyticsController.getCommonCorrections)
);

/**
 * @route GET /api/analytics/prompt-preferences
 * @description 프롬프트 유형별 선호도 통계
 * @query {string} [period=all] - 통계 기간 (day, week, month, all)
 * @returns {Object} 각 프롬프트 유형의 선택 비율 및 평가
 * @access Public
 */
router.get(
  "/prompt-preferences",
  asyncHandler(analyticsController.getPromptPreferences)
);

/**
 * @route GET /api/analytics/feedback
 * @description 사용자 피드백 통계 조회
 * @query {string} [period=all] - 통계 기간 (day, week, month, all)
 * @returns {Object} 평점 분포, 코멘트 분석 등
 * @access Public
 */
router.get("/feedback", asyncHandler(analyticsController.getFeedbackStats));

/**
 * @route GET /api/analytics/category-stats
 * @description 카테고리별 교정 통계 조회
 * @query {string} [period=all] - 통계 기간 (day, week, month, all)
 * @returns {Array} 카테고리별 교정 요청 및 결과 통계
 * @access Public
 */
router.get(
  "/category-stats",
  asyncHandler(analyticsController.getCategoryStats)
);

/**
 * @route GET /api/analytics/user-activity/:userId
 * @description 특정 사용자의 활동 통계 조회
 * @param {string} userId - 사용자 ID
 * @query {string} [period=month] - 통계 기간 (day, week, month, year, all)
 * @returns {Object} 사용자 활동 통계
 * @access Public
 */
router.get(
  "/user-activity/:userId",
  asyncHandler(analyticsController.getUserActivity)
);

module.exports = router;
