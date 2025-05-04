const mongoose = require("mongoose");
const Article = require("../models/article.model");
const Proofreading = require("../models/proofreading.model");
const logger = require("../utils/logger");

/**
 * 분석 데이터를 수집하고 반환하는 서비스
 */
class AnalyticsService {
  /**
   * 사용자 활동 통계를 조회합니다
   * @param {Object} filters - 필터 조건
   * @returns {Promise<Object>} - 통계 데이터
   */
  async getUserActivityStats(filters = {}) {
    try {
      const { userId, startDate, endDate } = filters;

      const matchCriteria = {};
      if (userId) matchCriteria.userId = userId;

      if (startDate || endDate) {
        matchCriteria.createdAt = {};
        if (startDate) matchCriteria.createdAt.$gte = new Date(startDate);
        if (endDate) matchCriteria.createdAt.$lte = new Date(endDate);
      }

      const proofreadingStats = await Proofreading.aggregate([
        { $match: matchCriteria },
        {
          $group: {
            _id: null,
            totalProofreadings: { $sum: 1 },
            uniqueArticles: { $addToSet: "$articleId" },
            averageCorrectionCount: {
              $avg: { $size: { $ifNull: ["$corrections", []] } },
            },
          },
        },
      ]);

      return {
        proofreadingCount: proofreadingStats[0]?.totalProofreadings || 0,
        uniqueArticleCount: proofreadingStats[0]?.uniqueArticles?.length || 0,
        averageCorrectionCount:
          proofreadingStats[0]?.averageCorrectionCount || 0,
      };
    } catch (error) {
      logger.error(`Error in getUserActivityStats: ${error.message}`);
      throw error;
    }
  }

  /**
   * 교정 유형별 통계를 조회합니다
   * @param {Object} filters - 필터 조건
   * @returns {Promise<Object>} - 통계 데이터
   */
  async getCorrectionTypeStats(filters = {}) {
    try {
      const { userId, startDate, endDate } = filters;

      const matchCriteria = {};
      if (userId) matchCriteria.userId = userId;

      if (startDate || endDate) {
        matchCriteria.createdAt = {};
        if (startDate) matchCriteria.createdAt.$gte = new Date(startDate);
        if (endDate) matchCriteria.createdAt.$lte = new Date(endDate);
      }

      const correctionStats = await Proofreading.aggregate([
        { $match: matchCriteria },
        { $unwind: { path: "$corrections", preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: "$corrections.type",
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
      ]);

      return correctionStats.reduce((result, item) => {
        if (item._id) {
          result[item._id] = item.count;
        }
        return result;
      }, {});
    } catch (error) {
      logger.error(`Error in getCorrectionTypeStats: ${error.message}`);
      throw error;
    }
  }

  /**
   * 시간대별 교정 요청 통계를 조회합니다
   * @param {Object} filters - 필터 조건
   * @returns {Promise<Array>} - 시간대별 통계 데이터
   */
  async getTimeBasedStats(filters = {}) {
    try {
      const { userId, startDate, endDate, interval = "day" } = filters;

      const matchCriteria = {};
      if (userId) matchCriteria.userId = userId;

      if (startDate || endDate) {
        matchCriteria.createdAt = {};
        if (startDate) matchCriteria.createdAt.$gte = new Date(startDate);
        if (endDate) matchCriteria.createdAt.$lte = new Date(endDate);
      }

      let dateFormat;
      switch (interval) {
        case "hour":
          dateFormat = {
            $dateToString: { format: "%Y-%m-%d %H:00", date: "$createdAt" },
          };
          break;
        case "day":
          dateFormat = {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          };
          break;
        case "week":
          dateFormat = {
            $dateToString: {
              format: "%Y-W%U",
              date: "$createdAt",
            },
          };
          break;
        case "month":
          dateFormat = {
            $dateToString: { format: "%Y-%m", date: "$createdAt" },
          };
          break;
        default:
          dateFormat = {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          };
      }

      const timeStats = await Proofreading.aggregate([
        { $match: matchCriteria },
        {
          $group: {
            _id: dateFormat,
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]);

      return timeStats.map((item) => ({
        timePeriod: item._id,
        count: item.count,
      }));
    } catch (error) {
      logger.error(`Error in getTimeBasedStats: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new AnalyticsService();
