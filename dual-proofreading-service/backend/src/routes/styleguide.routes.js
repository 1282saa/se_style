// src/routes/styleGuide.routes.js
const express = require("express");
const router = express.Router();
const styleGuideController = require("../controllers/styleGuide.controller");

// 스타일 가이드 기본 라우트
router.get("/", styleGuideController.getStyleGuides);
router.get("/:id", styleGuideController.getStyleGuide);
router.post("/", styleGuideController.createStyleGuide);
router.put("/:id", styleGuideController.updateStyleGuide);
router.delete("/:id", styleGuideController.deleteStyleGuide);

// 스타일 가이드 검색 및 분석 라우트
router.post("/search", styleGuideController.searchRelatedStyleGuides);
router.get("/categories", styleGuideController.getCategories);
router.get("/tags", styleGuideController.getTags);

// 스타일북 및 임베딩 관련 라우트
router.post("/import", styleGuideController.importStyleBook);
router.post("/generate-embeddings", styleGuideController.generateEmbeddings);
router.post("/vector-search", styleGuideController.testVectorSearch);

module.exports = router;
