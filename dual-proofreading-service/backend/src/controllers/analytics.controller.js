// src/controllers/analytics.controller.js
const mongoose = require("mongoose");
const Article = require("../models/article.model");
const Correction = require("../models/correction.model");
const UserChoice = require("../models/userChoice.model");
const analyticsService = require("../services/analyticsService");
const logger = require("../utils/logger");

/**
 * 사용자별 교정 선호도를 분석합니다.
 * @route GET /api/analytics/user-preferences/:userId
 */
const getUserPreferences = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "사용자 ID가 제공되지 않았습니다.",
      });
    }

    // 사용자 선호도 분석
    const preferences = await analyticsService.analyzeUserPreferences(userId);

    res.status(200).json({
      success: true,
      data: preferences,
    });
  } catch (error) {
    logger.error(`사용자 선호도 분석 오류: ${error.message}`);
    res.status(500).json({
      success: false,
      message: `사용자 선호도 분석 중 오류가 발생했습니다: ${error.message}`,
    });
  }
};

/**
 * 전체 서비스 통계를 조회합니다.
 * @route GET /api/analytics/stats
 */
const getServiceStats = async (req, res) => {
  try {
    const { period = "all" } = req.query;
    let startDate, endDate;

    // 기간 설정
    const now = new Date();

    switch (period) {
      case "day":
        startDate = new Date(now.setHours(0, 0, 0, 0));
        endDate = new Date();
        break;
      case "week":
        startDate = new Date(now.setDate(now.getDate() - 7));
        endDate = new Date();
        break;
      case "month":
        startDate = new Date(now.setMonth(now.getMonth() - 1));
        endDate = new Date();
        break;
      case "all":
      default:
        startDate = null;
        endDate = null;
        break;
    }

    // 통계 데이터 수집
    const query = {};
    if (startDate && endDate) {
      query.createdAt = {
        $gte: startDate,
        $lte: endDate,
      };
    }

    // Promise.all로 병렬 처리
    const [
      totalArticles,
      totalCorrections,
      totalUserChoices,
      promptTypeDistribution,
      avgRating,
    ] = await Promise.all([
      Article.countDocuments(query),
      Correction.countDocuments(query),
      UserChoice.countDocuments(query),
      analyticsService.getPromptTypeDistribution(startDate, endDate),
      analyticsService.getAverageRating(startDate, endDate),
    ]);

    res.status(200).json({
      success: true,
      data: {
        period,
        totalArticles,
        totalCorrections,
        totalUserChoices,
        promptTypeDistribution,
        avgRating,
      },
    });
  } catch (error) {
    logger.error(`서비스 통계 조회 오류: ${error.message}`);
    res.status(500).json({
      success: false,
      message: `서비스 통계 조회 중 오류가 발생했습니다: ${error.message}`,
    });
  }
};

/**
 * 교정 시간 통계를 조회합니다.
 * @route GET /api/analytics/correction-time
 */
const getCorrectionTimeStats = async (req, res) => {
  try {
    const { period = "month" } = req.query;

    // 교정 시간 통계 조회
    const stats = await analyticsService.getCorrectionTimeStats(period);

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error(`교정 시간 통계 조회 오류: ${error.message}`);
    res.status(500).json({
      success: false,
      message: `교정 시간 통계 조회 중 오류가 발생했습니다: ${error.message}`,
    });
  }
};

/**
 * 자주 발생하는 교정 유형을 분석합니다.
 * @route GET /api/analytics/common-corrections
 */
const getCommonCorrections = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    // 자주 발생하는 교정 유형 분석
    const commonCorrections = await analyticsService.analyzeCommonCorrections(
      parseInt(limit, 10)
    );

    res.status(200).json({
      success: true,
      data: {
        commonCorrections,
      },
    });
  } catch (error) {
    logger.error(`자주 발생하는 교정 유형 분석 오류: ${error.message}`);
    res.status(500).json({
      success: false,
      message: `자주 발생하는 교정 유형 분석 중 오류가 발생했습니다: ${error.message}`,
    });
  }
};

/**
 * 프롬프트 유형별 선호도를 분석합니다.
 * @route GET /api/analytics/prompt-preferences
 */
const getPromptPreferences = async (req, res) => {
  try {
    // 프롬프트 유형별 선호도 분석
    const preferences = await analyticsService.analyzePromptPreferences();

    res.status(200).json({
      success: true,
      data: preferences,
    });
  } catch (error) {
    logger.error(`프롬프트 유형별 선호도 분석 오류: ${error.message}`);
    res.status(500).json({
      success: false,
      message: `프롬프트 유형별 선호도 분석 중 오류가 발생했습니다: ${error.message}`,
    });
  }
};

/**
 * 사용자 피드백 통계를 조회합니다.
 * @route GET /api/analytics/feedback
 */
const getFeedbackStats = async (req, res) => {
  try {
    // 사용자 피드백 통계 조회
    const stats = await analyticsService.getFeedbackStats();

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error(`사용자 피드백 통계 조회 오류: ${error.message}`);
    res.status(500).json({
      success: false,
      message: `사용자 피드백 통계 조회 중 오류가 발생했습니다: ${error.message}`,
    });
  }
};

/**
 * 카테고리별 교정 통계를 조회합니다.
 * @route GET /api/analytics/category-stats
 */
const getCategoryStats = async (req, res) => {
  try {
    // 카테고리별 교정 통계 조회
    const stats = await analyticsService.getCategoryStats();

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error(`카테고리별 교정 통계 조회 오류: ${error.message}`);
    res.status(500).json({
      success: false,
      message: `카테고리별 교정 통계 조회 중 오류가 발생했습니다: ${error.message}`,
    });
  }
};

module.exports = {
  getUserPreferences,
  getServiceStats,
  getCorrectionTimeStats,
  getCommonCorrections,
  getPromptPreferences,
  getFeedbackStats,
  getCategoryStats,
};
