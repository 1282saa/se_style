// src/routes/article.routes.js
const express = require("express");
const router = express.Router();
const articleController = require("../controllers/article.controller");

// 기사 기본 라우트
router.post("/", articleController.createArticle);
router.get("/", articleController.getUserArticles);
router.get("/:id", articleController.getArticle);

// 교정 관련 라우트
router.post("/quick-proofread", articleController.quickProofread);
router.post("/:id/proofread", articleController.proofreadArticle);
router.get("/:id/corrections", articleController.getCorrections);

// 사용자 선택 라우트
router.post("/:id/choose", articleController.saveUserChoice);

module.exports = router;
