const socialMediaService = require("../services/socialMediaService");
const SocialPost = require("../models/socialPost.model");
const SocialAccount = require("../models/socialAccount.model");
const logger = require("../utils/logger");

/**
 * 소셜 미디어 연결 계정 목록 조회
 * @async
 * @function getConnectedAccounts
 * @param {Object} req - Express 요청 객체
 * @param {Object} res - Express 응답 객체
 * @returns {Object} 연결된 계정 목록
 */
const getConnectedAccounts = async (req, res) => {
  try {
    const { userId } = req.user; // 인증 미들웨어에서 추가된 사용자 정보

    const accounts = await socialMediaService.getConnectedAccounts(userId);

    res.status(200).json({
      success: true,
      data: accounts,
    });
  } catch (error) {
    logger.error(`계정 목록 조회 오류: ${error.message}`);
    res.status(500).json({
      success: false,
      message: "소셜 미디어 계정 목록 조회에 실패했습니다.",
      error: error.message,
    });
  }
};

/**
 * 소셜 미디어 계정 연결
 * @async
 * @function connectAccount
 * @param {Object} req - Express 요청 객체
 * @param {Object} res - Express 응답 객체
 * @returns {Object} 연결된 계정 정보
 */
const connectAccount = async (req, res) => {
  try {
    const { userId } = req.user; // 인증 미들웨어에서 추가된 사용자 정보
    const { platform } = req.params;
    const accountData = req.body;

    // 필수 정보 확인
    if (!accountData.accessToken || !accountData.platformUserId) {
      return res.status(400).json({
        success: false,
        message: "엑세스 토큰과 플랫폼 사용자 ID는 필수입니다.",
      });
    }

    // 지원하는 플랫폼 확인
    const supportedPlatforms = [
      "instagram",
      "facebook",
      "twitter",
      "thread",
      "linkedin",
    ];
    if (!supportedPlatforms.includes(platform)) {
      return res.status(400).json({
        success: false,
        message: `지원하지 않는 플랫폼입니다: ${platform}`,
      });
    }

    const account = await socialMediaService.connectAccount(
      userId,
      platform,
      accountData
    );

    res.status(200).json({
      success: true,
      message: `${platform} 계정이 성공적으로 연결되었습니다.`,
      data: account,
    });
  } catch (error) {
    logger.error(`계정 연결 오류: ${error.message}`);
    res.status(500).json({
      success: false,
      message: "소셜 미디어 계정 연결에 실패했습니다.",
      error: error.message,
    });
  }
};

/**
 * 소셜 미디어 포스트 생성
 * @async
 * @function generatePost
 * @param {Object} req - Express 요청 객체
 * @param {Object} res - Express 응답 객체
 * @returns {Object} 생성된 포스트 정보
 */
const generatePost = async (req, res) => {
  try {
    const { articleId, platform, correctionId } = req.body;
    const userId = req.body.userId || req.user?.id || "anonymous";
    const options = {
      ...req.body.options,
      correctionId,
      userId,
    };

    const post = await socialMediaService.generateSocialPost(
      articleId,
      platform,
      options
    );

    res.status(200).json({
      success: true,
      message: `${platform}용 게시물이 생성되었습니다`,
      data: post,
    });
  } catch (error) {
    logger.error(`소셜 미디어 포스트 생성 오류: ${error.message}`);
    res.status(500).json({
      success: false,
      message: `게시물 생성 중 오류가 발생했습니다: ${error.message}`,
    });
  }
};

/**
 * 소셜 미디어에 포스트 게시
 * @async
 * @function publishPost
 * @param {Object} req - Express 요청 객체
 * @param {Object} res - Express 응답 객체
 * @returns {Object} 게시 결과
 */
const publishPost = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.body.userId || req.user?.id || "anonymous";

    const post = await socialMediaService.publishPost(postId, userId);

    res.status(200).json({
      success: true,
      message: `${post.platform}에 게시되었습니다`,
      data: {
        id: post._id,
        platform: post.platform,
        status: post.status,
        platformPostId: post.platformPostId,
        publishedAt: post.publishedAt,
      },
    });
  } catch (error) {
    logger.error(`소셜 미디어 게시 오류: ${error.message}`);
    res.status(500).json({
      success: false,
      message: `게시 중 오류가 발생했습니다: ${error.message}`,
    });
  }
};

/**
 * 소셜 미디어 포스트 목록 조회
 * @async
 * @function getUserPosts
 * @param {Object} req - Express 요청 객체
 * @param {Object} res - Express 응답 객체
 * @returns {Object} 포스트 목록
 */
const getUserPosts = async (req, res) => {
  try {
    const userId = req.query.userId || req.user?.id || "anonymous";
    const { page = 1, limit = 10 } = req.query;

    const options = {
      skip: (page - 1) * parseInt(limit),
      limit: parseInt(limit),
      sort: { createdAt: -1 },
    };

    const posts = await SocialPost.find({ userId }, null, options);
    const total = await SocialPost.countDocuments({ userId });

    res.status(200).json({
      success: true,
      message: "소셜 미디어 포스트 목록",
      data: {
        posts,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    logger.error(`소셜 미디어 포스트 목록 조회 오류: ${error.message}`);
    res.status(500).json({
      success: false,
      message: `포스트 목록 조회 중 오류가 발생했습니다: ${error.message}`,
    });
  }
};

/**
 * 소셜 미디어 통계 정보 조회
 * @async
 * @function getSocialMediaStatistics
 * @param {Object} req - Express 요청 객체
 * @param {Object} res - Express 응답 객체
 * @returns {Object} 통계 정보
 */
const getSocialMediaStatistics = async (req, res) => {
  try {
    const { platform } = req.query;
    const userId = req.query.userId || req.user?.id || "anonymous";

    // 계정 정보 조회
    const account = await SocialAccount.findOne({
      userId,
      platform,
      isActive: true,
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        message: `연결된 ${platform} 계정을 찾을 수 없습니다`,
      });
    }

    // 플랫폼별 통계 서비스 호출
    const platformService = socialMediaService._getPlatformService(platform, {
      accessToken: account.accessToken,
      refreshToken: account.refreshToken,
      userId: account.platformUserId,
    });

    let statistics = null;

    // 플랫폼별 통계 요청 처리
    if (platform === "instagram") {
      statistics = await platformService.getUserStatistics(30);
    } else if (platform === "thread") {
      statistics = await platformService.getUserInsights();
    } else {
      return res.status(400).json({
        success: false,
        message: `지원하지 않는 플랫폼입니다: ${platform}`,
      });
    }

    res.status(200).json({
      success: true,
      message: `${platform} 통계 정보`,
      data: statistics,
    });
  } catch (error) {
    logger.error(`통계 조회 오류: ${error.message}`);
    res.status(500).json({
      success: false,
      message: `통계 조회 중 오류가 발생했습니다: ${error.message}`,
    });
  }
};

module.exports = {
  getConnectedAccounts,
  connectAccount,
  generatePost,
  publishPost,
  getUserPosts,
  getSocialMediaStatistics,
};
