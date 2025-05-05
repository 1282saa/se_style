// src/controllers/article.controller.js
const mongoose = require("mongoose");
const proofreadingService = require("../services/proofreadingService");
const Article = require("../models/article.model");
const Correction = require("../models/correction.model");
const UserChoice = require("../models/userChoice.model");
const logger = require("../utils/logger");

/**
 * 새 기사를 생성합니다.
 * @async
 * @function createArticle
 * @param {Object} req - Express 요청 객체
 * @param {Object} req.body - 요청 바디
 * @param {string} req.body.originalText - 원본 기사 텍스트
 * @param {string} [req.body.userId="anonymous"] - 사용자 ID
 * @param {string} [req.body.topic] - 기사 주제
 * @param {string} [req.body.category] - 기사 카테고리
 * @param {Object} [req.body.metadata] - 기사 메타데이터
 * @param {Object} res - Express 응답 객체
 * @returns {Object} 생성된 기사 정보
 * @throws {Error} 기사 생성 중 발생한 오류
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
 * @async
 * @function getArticleById
 * @param {Object} req - Express 요청 객체
 * @param {Object} req.params - URL 매개변수
 * @param {string} req.params.id - 조회할 기사 ID
 * @param {Object} res - Express 응답 객체
 * @returns {Object} 기사 상세 정보
 * @throws {Error} 기사 조회 중 발생한 오류
 */
const getArticleById = async (req, res) => {
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
 * @async
 * @function getUserArticles
 * @param {Object} req - Express 요청 객체
 * @param {Object} req.query - 쿼리 매개변수
 * @param {string} req.query.userId - 사용자 ID
 * @param {number} [req.query.page=1] - 페이지 번호
 * @param {number} [req.query.limit=10] - 페이지당 항목 수
 * @param {Object} res - Express 응답 객체
 * @returns {Object} 기사 목록 및 페이지네이션 정보
 * @throws {Error} 기사 목록 조회 중 발생한 오류
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
 * @async
 * @function quickProofread
 * @param {Object} req - Express 요청 객체
 * @param {Object} req.body - 요청 바디
 * @param {string} req.body.text - 교정할 텍스트
 * @param {string} [req.body.userId="anonymous"] - 사용자 ID
 * @param {Object} [req.body.metadata={}] - 교정 메타데이터
 * @param {Object} res - Express 응답 객체
 * @returns {Object} 교정 결과
 * @throws {Error} 교정 중 발생한 오류
 */
const quickProofread = async (req, res) => {
  try {
    const { text, userId = "anonymous", metadata = {} } = req.body;

    // 요청 로깅
    logger.info(`빠른 교정 API 요청 (텍스트 길이: ${text?.length || 0})`);

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

    // 응답 구조 로깅
    logger.info(
      `빠른 교정 API 응답 구조: ${JSON.stringify({
        hasArticleId: !!result.articleId,
        hasOriginal: !!result.original,
        correctionsCount: result.corrections?.length || 0,
        hasCorrections: !!result.corrections,
        firstCorrectionHasText: result.corrections?.[0]?.text ? true : false,
      })}`
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
 * @async
 * @function proofreadArticle
 * @param {Object} req - Express 요청 객체
 * @param {Object} req.params - URL 매개변수
 * @param {string} req.params.id - 교정할 기사 ID
 * @param {Object} [req.body.preferences] - 교정 환경설정
 * @param {Object} res - Express 응답 객체
 * @returns {Object} 교정 결과
 * @throws {Error} 교정 중 발생한 오류
 */
const proofreadArticle = async (req, res) => {
  try {
    const { id } = req.params;
    const { preferences = {} } = req.body;

    // 기사 존재 여부 확인
    const article = await Article.findById(id);
    if (!article) {
      return res.status(404).json({
        success: false,
        message: "기사를 찾을 수 없습니다.",
      });
    }

    // 교정 수행
    const corrections = await proofreadingService.proofreadArticle(
      id,
      preferences
    );

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
 * @async
 * @function getArticleCorrections
 * @param {Object} req - Express 요청 객체
 * @param {Object} req.params - URL 매개변수
 * @param {string} req.params.id - 기사 ID
 * @param {Object} res - Express 응답 객체
 * @returns {Object} 기사 교정 결과 목록
 * @throws {Error} 교정 결과 조회 중 발생한 오류
 */
const getArticleCorrections = async (req, res) => {
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
 * @async
 * @function saveUserChoice
 * @param {Object} req - Express 요청 객체
 * @param {Object} req.params - URL 매개변수
 * @param {string} req.params.id - 기사 ID
 * @param {Object} req.body - 요청 바디
 * @param {string} req.body.correctionId - 선택한 교정 결과 ID
 * @param {number} [req.body.rating] - 평가 점수 (1-5)
 * @param {string} [req.body.comment] - 사용자 의견
 * @param {Object} [req.body.metadata] - 추가 메타데이터
 * @param {Object} res - Express 응답 객체
 * @returns {Object} 저장된 사용자 선택 정보
 * @throws {Error} 사용자 선택 저장 중 발생한 오류
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

/**
 * 특정 기사에 대한 사용자 선택을 조회합니다.
 * @async
 * @function getArticleUserChoices
 * @param {Object} req - Express 요청 객체
 * @param {Object} req.params - URL 매개변수
 * @param {string} req.params.id - 기사 ID
 * @param {Object} res - Express 응답 객체
 * @returns {Object} 사용자 선택 목록
 * @throws {Error} 사용자 선택 조회 중 발생한 오류
 */
const getArticleUserChoices = async (req, res) => {
  try {
    const { id } = req.params;

    // 사용자 선택 조회
    const userChoices = await UserChoice.find({ articleId: id }).populate(
      "correctionId"
    );

    res.status(200).json({
      success: true,
      data: {
        articleId: id,
        userChoices,
      },
    });
  } catch (error) {
    logger.error(`사용자 선택 조회 오류: ${error.message}`);
    res.status(500).json({
      success: false,
      message: `사용자 선택 조회 중 오류가 발생했습니다: ${error.message}`,
    });
  }
};

module.exports = {
  createArticle,
  getArticleById,
  getUserArticles,
  quickProofread,
  proofreadArticle,
  getArticleCorrections,
  saveUserChoice,
  getArticleUserChoices,
};
