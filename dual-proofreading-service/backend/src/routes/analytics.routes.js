// src/routes/analytics.routes.js
const express = require("express");
const router = express.Router();
const analyticsController = require("../controllers/analytics.controller");

// 사용자 분석 라우트
router.get("/user-preferences/:userId", analyticsController.getUserPreferences);

// 서비스 통계 라우트
router.get("/stats", analyticsController.getServiceStats);
router.get("/correction-time", analyticsController.getCorrectionTimeStats);
router.get("/common-corrections", analyticsController.getCommonCorrections);
router.get("/prompt-preferences", analyticsController.getPromptPreferences);
router.get("/feedback", analyticsController.getFeedbackStats);
router.get("/category-stats", analyticsController.getCategoryStats);

module.exports = router;
