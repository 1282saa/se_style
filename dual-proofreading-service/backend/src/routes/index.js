// src/routes/index.js
const express = require("express");
const router = express.Router();

// 서브 라우터 가져오기
const articleRoutes = require("./article.routes");
const styleGuideRoutes = require("./styleguide.routes");
const analyticsRoutes = require("./analytics.routes");

// 라우트 설정
router.use("/api/articles", articleRoutes);
router.use("/api/style-guides", styleGuideRoutes);
router.use("/api/analytics", analyticsRoutes);

// 서버 상태 확인
router.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    message: "Server is running",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  });
});

// 존재하지 않는 라우트 처리
router.use("*", (req, res) => {
  res.status(404).json({
    status: "Error",
    message: "Resource not found",
  });
});

module.exports = router;
