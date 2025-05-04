/**
 * 메인 라우터 설정
 * 모든 API 엔드포인트를 조합하여 라우팅 구성을 제공합니다
 * @module routes/index
 */

const express = require("express");
const apiRoutes = require("./api.routes");
const articleRoutes = require("./article.routes");
const styleGuideRoutes = require("./styleguide.routes");
const analyticsRoutes = require("./analytics.routes");

// 버전 정보
const API_VERSION = "1.0.1";
const BUILD_DATE = "2025-05-04";

const router = express.Router();

/**
 * API 엔드포인트 매핑
 * 각 컨트롤러 그룹에 대한 경로 접두사 설정
 */
router.use("/api", apiRoutes);
router.use("/api/articles", articleRoutes);
router.use("/api/styleguides", styleGuideRoutes);
router.use("/api/analytics", analyticsRoutes);

/**
 * @route GET /
 * @description API 루트 경로 - 서비스 정보 및 주요 엔드포인트 안내 제공
 * @access Public
 */
router.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "한국어 교열 서비스 API",
    version: API_VERSION,
    buildDate: BUILD_DATE,
    documentation: "/api/docs",
    endpoints: {
      quickProofread: "POST /api/proofread",
      articleProofread: "POST /api/articles/:id/proofread",
      styleGuides: "GET /api/styleguides",
      analytics: "GET /api/analytics/stats",
      customProofread: "POST /api/proofread/custom",
    },
  });
});

/**
 * @route GET /health
 * @description 서비스 상태 확인 엔드포인트
 * @access Public
 */
router.get("/health", (req, res) => {
  const memoryUsage = process.memoryUsage();

  res.status(200).json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    memory: {
      rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
      heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
      heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
    },
    version: API_VERSION,
  });
});

/**
 * @route GET /api/version
 * @description API 버전 정보 조회
 * @access Public
 */
router.get("/api/version", (req, res) => {
  res.status(200).json({
    version: API_VERSION,
    buildDate: BUILD_DATE,
  });
});

// 404 처리
router.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "요청한 리소스를 찾을 수 없습니다",
    path: req.originalUrl,
  });
});

module.exports = router;
