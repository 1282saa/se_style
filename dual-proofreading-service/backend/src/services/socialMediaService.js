// src/services/socialMediaService.js
const SocialAccount = require("../models/socialAccount.model");
const SocialPost = require("../models/socialPost.model");
const InstagramService = require("./social/instagramService");
const ThreadService = require("./social/threadService");
const { generateSocialContent } = require("./llm/anthropicService");
const logger = require("../utils/logger");

/**
 * 연결된 소셜 미디어 계정 목록 조회
 * @param {string} userId - 사용자 ID
 * @returns {Promise<Array>} - 연결된 계정 목록
 */
async function getConnectedAccounts(userId) {
  try {
    const accounts = await SocialAccount.find({ userId, isActive: true });
    return accounts;
  } catch (error) {
    console.error("소셜 미디어 계정 조회 중 오류:", error);
    throw new Error("소셜 미디어 계정 조회에 실패했습니다.");
  }
}

/**
 * 소셜 미디어 계정 연결
 * @param {string} userId - 사용자 ID
 * @param {string} platform - 플랫폼 (instagram, thread 등)
 * @param {Object} accountData - 계정 연결 데이터 (accessToken, platformUserId 등)
 * @returns {Promise<Object>} - 연결된 계정 정보
 */
async function connectAccount(userId, platform, accountData) {
  try {
    // 기존 계정이 있는지 확인
    let account = await SocialAccount.findOne({ userId, platform });

    if (account) {
      // 기존 계정 업데이트
      account.accessToken = accountData.accessToken;
      if (accountData.refreshToken)
        account.refreshToken = accountData.refreshToken;
      account.platformUserId = accountData.platformUserId;
      if (accountData.username) account.username = accountData.username;
      if (accountData.tokenExpiry)
        account.tokenExpiry = accountData.tokenExpiry;
      account.isActive = true;
      account.lastUsed = new Date();

      await account.save();
    } else {
      // 새 계정 생성
      account = new SocialAccount({
        userId,
        platform,
        accessToken: accountData.accessToken,
        refreshToken: accountData.refreshToken,
        platformUserId: accountData.platformUserId,
        username: accountData.username,
        tokenExpiry: accountData.tokenExpiry,
        lastUsed: new Date(),
      });

      await account.save();
    }

    // 민감한 정보 제거 후 반환
    const safeAccount = account.toObject();
    delete safeAccount.accessToken;
    delete safeAccount.refreshToken;

    return safeAccount;
  } catch (error) {
    console.error("소셜 미디어 계정 연결 중 오류:", error);
    throw new Error("소셜 미디어 계정 연결에 실패했습니다.");
  }
}

/**
 * 소셜 미디어 게시물 생성
 * @param {string} userId - 사용자 ID
 * @param {string} articleId - 기사 ID
 * @param {string} platform - 플랫폼 (instagram, thread 등)
 * @param {string} originalText - 원본 텍스트
 * @param {Object} options - 추가 옵션
 * @returns {Promise<Object>} - 생성된 게시물 정보
 */
async function generateSocialPost(
  userId,
  articleId,
  platform,
  originalText,
  options = {}
) {
  try {
    logger.info(
      `소셜 미디어 게시물 생성 시작: 플랫폼=${platform}, 텍스트 길이=${originalText.length}자`
    );

    // 플랫폼별 특성 및 제한 확인
    if (platform === "instagram" && !options.imageUrl) {
      logger.warn(
        "Instagram 게시물에는 이미지가 필요합니다. 기본 이미지를 사용합니다."
      );
      // 실제 환경에서는 기본 이미지 URL 설정 필요
      options.imageUrl =
        options.imageUrl || "https://via.placeholder.com/800x800";
    }

    // 플랫폼에 맞는 텍스트 생성
    const adaptedText = await generateSocialContent(originalText, platform);
    logger.debug(
      `플랫폼 최적화 텍스트 생성 완료: 길이=${adaptedText.length}자`
    );

    // 게시물 생성에 필요한 메타데이터 구성
    const metadata = {
      imageUrl: options.imageUrl,
      sourceArticleId: articleId,
      generatedAt: new Date(),
      options: {
        withHashtags: options.withHashtags !== false, // 기본값 true
        withEmojis: options.withEmojis !== false, // 기본값 true
      },
    };

    // 게시물 저장
    const post = new SocialPost({
      userId,
      articleId,
      platform,
      originalText,
      adaptedText,
      status: "ready",
      metadata,
    });

    await post.save();
    logger.info(`소셜 미디어 게시물 생성 완료: ID=${post._id}`);

    return post;
  } catch (error) {
    logger.error(`소셜 미디어 게시물 생성 중 오류: ${error.message}`);
    throw new Error(`소셜 미디어 게시물 생성에 실패했습니다: ${error.message}`);
  }
}

/**
 * 소셜 미디어에 게시물 게시
 * @param {string} userId - 사용자 ID
 * @param {string} postId - 게시물 ID
 * @returns {Promise<Object>} - 게시 결과
 */
async function publishPost(userId, postId) {
  try {
    // 게시물 조회
    const post = await SocialPost.findOne({ _id: postId, userId });
    if (!post) {
      throw new Error("게시물을 찾을 수 없습니다.");
    }

    // 계정 조회
    const account = await SocialAccount.findOne({
      userId,
      platform: post.platform,
      isActive: true,
    });

    if (!account) {
      throw new Error(`연결된 ${post.platform} 계정이 없습니다.`);
    }

    // 플랫폼별 게시 로직
    let result;
    if (post.platform === "instagram") {
      // Instagram 서비스 인스턴스 생성
      const instagramService = new InstagramService({
        accessToken: account.accessToken,
        platformUserId: account.platformUserId,
        username: account.username,
      });

      // 이미지 URL이 필요합니다 (Instagram은 이미지 없이 게시 불가)
      // post.metadata에서 이미지 URL을 가져오거나 기본 이미지 사용
      const imageUrl =
        post.metadata?.imageUrl || "https://via.placeholder.com/800x800";

      // Instagram에 게시
      result = await instagramService.publish(post.adaptedText, imageUrl);
    } else if (post.platform === "thread") {
      // Thread 서비스 인스턴스 생성
      const threadService = new ThreadService({
        accessToken: account.accessToken,
        platformUserId: account.platformUserId,
      });

      // 이미지 URL (선택 사항)
      const imageUrl = post.metadata?.imageUrl || null;

      // Thread에 게시
      result = await threadService.publish(post.adaptedText, imageUrl);
    } else {
      throw new Error(`지원하지 않는 플랫폼입니다: ${post.platform}`);
    }

    // 게시물 상태 업데이트
    post.status = "published";
    post.publishedAt = new Date();
    post.platformPostId = result.id;
    post.platformData = result;
    await post.save();

    return post;
  } catch (error) {
    console.error("소셜 미디어 게시 중 오류:", error);

    // 게시물 상태 업데이트 (실패)
    if (postId) {
      try {
        const post = await SocialPost.findById(postId);
        if (post) {
          post.status = "failed";
          post.metadata.error = error.message;
          await post.save();
        }
      } catch (updateError) {
        console.error("게시물 상태 업데이트 중 오류:", updateError);
      }
    }

    throw new Error(`소셜 미디어 게시에 실패했습니다: ${error.message}`);
  }
}

/**
 * 사용자의 소셜 미디어 게시물 목록 조회
 * @param {string} userId - 사용자 ID
 * @param {Object} filters - 필터 조건 (platform, status 등)
 * @returns {Promise<Array>} - 게시물 목록
 */
async function getUserPosts(userId, filters = {}) {
  try {
    const query = { userId, ...filters };
    const posts = await SocialPost.find(query).sort({ createdAt: -1 });
    return posts;
  } catch (error) {
    console.error("소셜 미디어 게시물 조회 중 오류:", error);
    throw new Error("소셜 미디어 게시물 조회에 실패했습니다.");
  }
}

/**
 * 소셜 미디어 통계 조회
 * @param {string} userId - 사용자 ID
 * @param {string} platform - 플랫폼 (선택 사항)
 * @returns {Promise<Object>} - 통계 정보
 */
async function getSocialStatistics(userId, platform) {
  try {
    // 계정 조회
    const query = { userId, isActive: true };
    if (platform) query.platform = platform;

    const accounts = await SocialAccount.find(query);

    if (accounts.length === 0) {
      throw new Error("연결된 소셜 미디어 계정이 없습니다.");
    }

    // 플랫폼별 통계 조회
    const stats = {};

    for (const account of accounts) {
      if (account.platform === "instagram") {
        // Instagram 서비스 인스턴스 생성
        const instagramService = new InstagramService({
          accessToken: account.accessToken,
          platformUserId: account.platformUserId,
          username: account.username,
        });

        // 통계 조회
        stats.instagram = await instagramService.getUserStatistics();
      } else if (account.platform === "thread") {
        // Thread 서비스 인스턴스 생성
        const threadService = new ThreadService({
          accessToken: account.accessToken,
          platformUserId: account.platformUserId,
        });

        // 통계 조회
        stats.thread = await threadService.getStatistics();
      }
    }

    return stats;
  } catch (error) {
    logger.error("소셜 미디어 통계 조회 중 오류:", error);
    throw new Error("소셜 미디어 통계 조회에 실패했습니다.");
  }
}

module.exports = {
  getConnectedAccounts,
  connectAccount,
  generateSocialPost,
  publishPost,
  getUserPosts,
  getSocialStatistics,
};
