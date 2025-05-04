// src/controllers/article.controller.js
const mongoose = require("mongoose");
const proofreadingService = require("../services/proofreadingService");
const Article = require("../models/article.model");
const Correction = require("../models/correction.model");
const logger = require("../utils/logger");

/**
 * 새 기사를 생성합니다.
 * @route POST /api/articles
 */
const createArticle = async (req, res) => {
  try {
    const articleData = {
      userId: req.body.userId || "anonymous",
      originalText: req.body.originalText,
      topic: req.body.topic,
      category: req.body.category,
      metadata: req.body.metadata,
    };

    // 필수 필드 검증
    if (!articleData.originalText) {
      return res.status(400).json({
        success: false,
        message: "원문 텍스트가 제공되지 않았습니다.",
      });
    }

    const savedArticle = await proofreadingService.createArticle(articleData);

    res.status(201).json({
      success: true,
      message: "기사가 성공적으로 생성되었습니다",
      data: {
        articleId: savedArticle._id,
        originalText: savedArticle.originalText,
      },
    });
  } catch (error) {
    logger.error(`기사 생성 오류: ${error.message}`);
    res.status(500).json({
      success: false,
      message: `기사 생성 중 오류가 발생했습니다: ${error.message}`,
    });
  }
};

/**
 * 특정 기사의 상세 정보를 조회합니다.
 * @route GET /api/articles/:id
 */
const getArticle = async (req, res) => {
  try {
    const { id } = req.params;

    const article = await Article.findById(id);
    if (!article) {
      return res.status(404).json({
        success: false,
        message: "기사를 찾을 수 없습니다.",
      });
    }

    res.status(200).json({
      success: true,
      data: article,
    });
  } catch (error) {
    logger.error(`기사 조회 오류: ${error.message}`);
    res.status(500).json({
      success: false,
      message: `기사 조회 중 오류가 발생했습니다: ${error.message}`,
    });
  }
};

/**
 * 사용자별 기사 목록을 조회합니다.
 * @route GET /api/articles
 */
const getUserArticles = async (req, res) => {
  try {
    const { userId, page = 1, limit = 10 } = req.query;

    // 사용자 ID는 필수
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "사용자 ID가 제공되지 않았습니다.",
      });
    }

    const options = {
      skip: (page - 1) * limit,
      limit: parseInt(limit, 10),
      sort: { createdAt: -1 },
    };

    const articles = await Article.find({ userId }, null, options);
    const total = await Article.countDocuments({ userId });

    res.status(200).json({
      success: true,
      data: {
        articles,
        pagination: {
          total,
          page: parseInt(page, 10),
          limit: parseInt(limit, 10),
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    logger.error(`사용자 기사 목록 조회 오류: ${error.message}`);
    res.status(500).json({
      success: false,
      message: `사용자 기사 목록 조회 중 오류가 발생했습니다: ${error.message}`,
    });
  }
};

/**
 * 빠른 교정을 수행합니다.
 * @route POST /api/articles/quick-proofread
 */
const quickProofread = async (req, res) => {
  try {
    const { text, userId = "anonymous", metadata = {} } = req.body;

    if (!text) {
      return res.status(400).json({
        success: false,
        message: "교정할 텍스트가 제공되지 않았습니다.",
      });
    }

    // 텍스트 길이 제한 검사
    if (text.length > 10000) {
      return res.status(400).json({
        success: false,
        message: "텍스트 길이가 너무 깁니다. 10,000자 이하로 입력해주세요.",
      });
    }

    // 빠른 교정 실행
    const result = await proofreadingService.quickProofread(
      text,
      userId,
      metadata
    );

    res.status(200).json({
      success: true,
      message: "교정이 완료되었습니다",
      data: result,
    });
  } catch (error) {
    logger.error(`빠른 교정 오류: ${error.message}`);
    res.status(500).json({
      success: false,
      message: `교정 중 오류가 발생했습니다: ${error.message}`,
    });
  }
};

/**
 * 특정 기사를 교정합니다.
 * @route POST /api/articles/:id/proofread
 */
const proofreadArticle = async (req, res) => {
  try {
    const { id } = req.params;

    // 기사 존재 여부 확인
    const article = await Article.findById(id);
    if (!article) {
      return res.status(404).json({
        success: false,
        message: "기사를 찾을 수 없습니다.",
      });
    }

    // 교정 수행
    const corrections = await proofreadingService.proofreadArticle(id);

    res.status(200).json({
      success: true,
      message: "기사 교정이 완료되었습니다",
      data: {
        articleId: id,
        corrections: corrections.map((c) => ({
          id: c._id,
          promptType: c.promptType,
          correctedText: c.correctedText,
        })),
      },
    });
  } catch (error) {
    logger.error(`기사 교정 오류: ${error.message}`);
    res.status(500).json({
      success: false,
      message: `기사 교정 중 오류가 발생했습니다: ${error.message}`,
    });
  }
};

/**
 * 특정 기사의 교정 결과를 조회합니다.
 * @route GET /api/articles/:id/corrections
 */
const getCorrections = async (req, res) => {
  try {
    const { id } = req.params;

    // 교정 결과 조회
    const corrections = await Correction.find({ articleId: id });

    if (!corrections || corrections.length === 0) {
      return res.status(404).json({
        success: false,
        message: "해당 기사의 교정 결과가 없습니다.",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        articleId: id,
        corrections,
      },
    });
  } catch (error) {
    logger.error(`교정 결과 조회 오류: ${error.message}`);
    res.status(500).json({
      success: false,
      message: `교정 결과 조회 중 오류가 발생했습니다: ${error.message}`,
    });
  }
};

/**
 * 사용자 선택을 저장합니다.
 * @route POST /api/articles/:id/choose
 */
const saveUserChoice = async (req, res) => {
  try {
    const { id } = req.params;
    const { correctionId, rating, comment, metadata } = req.body;

    // 필수 필드 검증
    if (!correctionId) {
      return res.status(400).json({
        success: false,
        message: "선택한 교정 결과 ID가 제공되지 않았습니다.",
      });
    }

    // 사용자 선택 저장
    const savedChoice = await proofreadingService.saveUserChoice(
      id,
      correctionId,
      { rating, comment, metadata }
    );

    res.status(200).json({
      success: true,
      message: "사용자 선택이 저장되었습니다",
      data: savedChoice,
    });
  } catch (error) {
    logger.error(`사용자 선택 저장 오류: ${error.message}`);
    res.status(500).json({
      success: false,
      message: `사용자 선택 저장 중 오류가 발생했습니다: ${error.message}`,
    });
  }
};

require("dotenv").config();

module.exports = {
  // 데이터베이스 설정
  MONGODB_URI: process.env.MONGODB_URI,

  // 서버 설정
  PORT: process.env.PORT || 3000,
  NODE_ENV: process.env.NODE_ENV || "development",

  // CORS 설정
  CORS_ORIGIN: process.env.CORS_ORIGIN || "*",

  // 로깅 설정
  LOG_LEVEL: process.env.LOG_LEVEL || "info",

  // 인증 설정
  JWT_SECRET: process.env.JWT_SECRET || "your-secret-key",
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "1d",

  // LLM 설정
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,

  // 임베딩 설정
  EMBEDDING_MODEL: process.env.EMBEDDING_MODEL || "text-embedding-3-small",
  EMBEDDING_DIMENSION: parseInt(process.env.EMBEDDING_DIMENSION || "1536", 10),

  // 기타 설정
  MAX_TEXT_LENGTH: parseInt(process.env.MAX_TEXT_LENGTH || "10000", 10),
  DEFAULT_PROMPT_TEMPLATE: process.env.DEFAULT_PROMPT_TEMPLATE || "standard",
};
            