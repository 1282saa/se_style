// src/controllers/api.controller.js
const proofreadingService = require("../services/proofreadingService");
const styleGuideService = require("../services/styleGuideService");
const {
  asyncHandler,
  ValidationError,
  NotFoundError,
} = require("../utils/errorHandler");
const textProcessor = require("../utils/textProcessor");
const logger = require("../utils/logger");

/**
 * 간편 교정 API
 * - 기사 텍스트를 입력받아 바로 두 가지 교정 결과 제공
 * @route POST /api/proofread
 */
const quickProofread = asyncHandler(async (req, res) => {
  const { text, userId = "anonymous", metadata = {} } = req.body;

  // 입력 유효성 검사
  if (!text) {
    return res.status(400).json({
      success: false,
      message: "교정할 텍스트가 제공되지 않았습니다.",
    });
  }

  // 텍스트 길이 제한
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

  // 응답 구성
  res.status(200).json({
    success: true,
    message: "교정이 완료되었습니다",
    data: result,
  });
});

/**
 * 교정 결과 상세 조회 API
 * - 특정 교정 결과의 상세 내용과 변경 사항 제공
 * @route GET /api/corrections/:id
 */
const getCorrectionDetails = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // 교정 결과 조회
  const correction = await proofreadingService.getCorrectionById(id);

  if (!correction) {
    throw new NotFoundError("교정 결과를 찾을 수 없습니다.");
  }

  // 기사 정보 조회
  const article = await proofreadingService.getArticleById(
    correction.articleId
  );

  if (!article) {
    throw new NotFoundError("원문 기사를 찾을 수 없습니다.");
  }

  // 변경 사항 분석
  const changes =
    correction.changes && correction.changes.length > 0
      ? correction.changes
      : textProcessor.findChanges(
          article.originalText,
          correction.correctedText
        );

  // 복잡성 분석
  const originalComplexity = textProcessor.analyzeComplexity(
    article.originalText
  );
  const correctedComplexity = textProcessor.analyzeComplexity(
    correction.correctedText
  );

  // 응답 구성
  res.status(200).json({
    success: true,
    data: {
      correctionId: correction._id,
      articleId: article._id,
      promptType: correction.promptType,
      typeName: correction.promptType === 1 ? "최소 교정" : "적극적 교정",
      original: article.originalText,
      corrected: correction.correctedText,
      changes: changes.map((c) => ({
        type: c.type || c.original,
        original: c.original || c.originalText,
        corrected: c.corrected || c.suggestion || c.correctedText,
        explanation: c.explanation,
      })),
      stats: {
        originalLength: article.originalText.length,
        correctedLength: correction.correctedText.length,
        changesCount: changes.length,
        originalComplexity,
        correctedComplexity,
      },
      createdAt: correction.createdAt,
    },
  });
});

/**
 * 사용자 선택 저장 API
 * - 사용자가 선호하는 교정 결과 선택 및 피드백 저장
 * @route POST /api/choose
 */
const saveUserChoice = asyncHandler(async (req, res) => {
  const { articleId, correctionId, rating, comment } = req.body;

  // 입력 유효성 검사
  if (!articleId || !correctionId) {
    return res.status(400).json({
      success: false,
      message: "기사 ID와 선택한 교정 결과 ID가 필요합니다.",
    });
  }

  // 사용자 선택 저장
  const result = await proofreadingService.saveUserChoice(
    articleId,
    correctionId,
    { rating, comment }
  );

  // 응답 구성
  res.status(200).json({
    success: true,
    message: "사용자 선택이 저장되었습니다",
    data: {
      articleId: result.articleId,
      selectedCorrectionId: correctionId,
      selectedPromptType: result.selectedPromptType,
      feedback: {
        rating: result.rating,
        hasComment: !!result.comment && result.comment.length > 0,
      },
    },
  });
});

/**
 * 맞춤형 교정 API
 * - 사용자 선호에 맞는 맞춤형 교정 결과 생성
 * @route POST /api/proofread/custom
 */
const customProofread = asyncHandler(async (req, res) => {
  const { articleId, userId } = req.body;

  // 입력 유효성 검사
  if (!articleId) {
    return res.status(400).json({
      success: false,
      message: "기사 ID가 제공되지 않았습니다.",
    });
  }

  // 사용자 선호도 분석
  const preferences = await proofreadingService.analyzeUserPreferences(
    userId || "anonymous"
  );

  // 맞춤형 교정 생성
  const result = await proofreadingService.generateCustomCorrection(
    articleId,
    preferences
  );

  // 응답 구성
  res.status(200).json({
    success: true,
    message: "맞춤형 교정이 완료되었습니다",
    data: {
      correctionId: result.id,
      articleId: result.articleId,
      text: result.text,
      type: "custom",
      changes: result.changes,
      appliedPreferences: preferences,
    },
  });
});

/**
 * 서비스 상태 확인 API
 * @route GET /api/status
 */
const getServiceStatus = asyncHandler(async (req, res) => {
  // 간단한 상태 정보 응답
  res.status(200).json({
    success: true,
    data: {
      status: "operational",
      version: "1.0.0",
      timestamp: new Date().toISOString(),
    },
  });
});

module.exports = {
  quickProofread,
  getCorrectionDetails,
  saveUserChoice,
  customProofread,
  getServiceStatus,
};
