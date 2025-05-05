const axios = require("axios");
const logger = require("../../utils/logger");

/**
 * 스레드(Thread) API 서비스
 */
class ThreadService {
  /**
   * 스레드 서비스 초기화
   * @param {Object} credentials - 인증 정보
   */
  constructor(credentials) {
    this.accessToken = credentials.accessToken;
    this.userId = credentials.platformUserId; // Thread 계정 ID (Meta/Instagram 비즈니스 계정 ID)
    this.baseUrl = "https://graph.threads.net/v1.0"; // Thread API 기본 URL
    this.facebookUrl = "https://graph.facebook.com/v19.0"; // Facebook Graph API URL

    if (!this.accessToken) {
      throw new Error("스레드 엑세스 토큰이 필요합니다");
    }

    if (!this.userId) {
      throw new Error("스레드 계정 ID가 필요합니다");
    }

    logger.info(`스레드 서비스 초기화 (userId: ${this.userId})`);
  }

  /**
   * API 요청 처리
   * @private
   */
  async _makeRequest(method, endpoint, params = null, data = null) {
    try {
      let url;
      if (endpoint.startsWith("http")) {
        url = endpoint; // 전체 URL이 제공된 경우
      } else if (endpoint.includes("/")) {
        url = `${this.baseUrl}/${endpoint}`; // 경로가 포함된 경우
      } else {
        url = `${this.baseUrl}/${this.userId}/${endpoint}`; // 기본 경로 구성
      }

      const requestParams = { ...params, access_token: this.accessToken };

      logger.debug(`스레드 API 요청: ${method} ${url}`);

      const response = await axios({
        method,
        url,
        params: requestParams,
        data,
        headers: {
          "Content-Type": "application/json",
        },
      });

      return response.data;
    } catch (error) {
      logger.error(`스레드 API 요청 실패: ${error.message}`);
      if (axios.isAxiosError(error)) {
        logger.error(`API 응답: ${JSON.stringify(error.response?.data || {})}`);

        // Meta API 오류 처리
        if (error.response?.data?.error) {
          const { message, type, code } = error.response.data.error;
          throw new Error(`스레드 API 오류 (${type} ${code}): ${message}`);
        }
      }
      throw error;
    }
  }

  /**
   * 스레드 텍스트 게시물 생성 (1단계: 생성)
   * @param {string} text - 게시할 텍스트
   * @param {string} mediaUrl - 미디어 URL (선택사항)
   * @returns {Promise<string>} - 생성 ID
   */
  async createThread(text, mediaUrl = null) {
    try {
      logger.info(`스레드 생성 시작: 텍스트 길이 ${text.length}자`);

      // 텍스트가 500자를 초과하는지 확인 (Thread 제한)
      if (text.length > 500) {
        logger.warn(
          `텍스트가 너무 깁니다: ${text.length}자. 500자로 제한합니다.`
        );
        text = text.substring(0, 497) + "...";
      }

      // 1. 미디어 타입 결정
      let mediaType = "TEXT";
      let creationParams = {
        media_type: "TEXT",
        text: text,
      };

      if (mediaUrl) {
        // URL에서 파일 확장자 추출
        const fileExtension = mediaUrl.split(".").pop().toLowerCase();
        const videoExtensions = ["mp4", "mov", "avi", "webm"];

        if (videoExtensions.includes(fileExtension)) {
          mediaType = "VIDEO";
          creationParams.media_type = "VIDEO";
          creationParams.video_url = mediaUrl;
        } else {
          mediaType = "IMAGE";
          creationParams.media_type = "IMAGE";
          creationParams.image_url = mediaUrl;
        }
      }

      logger.debug(`미디어 타입: ${mediaType}`);

      // 2. 스레드 생성
      const creationData = await this._makeRequest(
        "POST",
        "threads",
        null,
        creationParams
      );

      if (!creationData || !creationData.id) {
        throw new Error(`스레드 생성 실패: ${JSON.stringify(creationData)}`);
      }

      const creationId = creationData.id;
      logger.debug(`스레드 생성 완료, ID: ${creationId}`);

      return creationId;
    } catch (error) {
      logger.error(`스레드 생성 오류: ${error.message}`);
      throw error;
    }
  }

  /**
   * 생성된 스레드 게시 (2단계: 게시)
   * @param {string} creationId - 스레드 생성 ID
   * @returns {Promise<Object>} - 게시된 스레드 정보
   */
  async publishThread(creationId) {
    try {
      logger.info(`스레드 게시 시작, 생성 ID: ${creationId}`);

      // 스레드 게시
      const publishData = await this._makeRequest(
        "POST",
        "threads_publish",
        null,
        { creation_id: creationId }
      );

      if (!publishData || !publishData.id) {
        throw new Error(`스레드 게시 실패: ${JSON.stringify(publishData)}`);
      }

      logger.info(`스레드 게시 성공, 스레드 ID: ${publishData.id}`);

      // 게시물 정보 반환
      return {
        id: publishData.id,
        permalink: `https://www.threads.net/t/${publishData.id}`, // 가정된 URL 형식
        creation_id: creationId,
      };
    } catch (error) {
      logger.error(`스레드 게시 오류: ${error.message}`);
      throw error;
    }
  }

  /**
   * 스레드에 게시
   * @param {string} text - 게시할 텍스트
   * @param {string} mediaUrl - 이미지/비디오 URL (옵션)
   * @returns {Promise<Object>} - 게시 결과
   */
  async publish(text, mediaUrl = null) {
    try {
      logger.info(`스레드에 게시 시도: 텍스트 길이 ${text.length}자`);

      // 1. 스레드 생성
      const creationId = await this.createThread(text, mediaUrl);

      // 2. 생성 후 약간의 대기 시간 (권장)
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // 3. 스레드 게시
      const publishData = await this.publishThread(creationId);

      logger.info(`스레드 게시 완료, 스레드 ID: ${publishData.id}`);
      return publishData;
    } catch (error) {
      logger.error(`스레드 게시 오류: ${error.message}`);
      throw error;
    }
  }

  /**
   * 사용자의 스레드 목록 조회
   * @param {number} limit - 조회할 최대 항목 수
   * @returns {Promise<Array>} - 스레드 목록
   */
  async getUserThreads(limit = 10) {
    try {
      logger.info(`스레드 목록 조회, 최대 ${limit}개`);

      const fields =
        "id,media_product_type,media_type,media_url,permalink,text,timestamp,shortcode,thumbnail_url,children,is_quote_post";

      const response = await this._makeRequest("GET", "threads", {
        fields,
        limit,
      });

      logger.info(
        `스레드 목록 조회 완료, ${response.data?.length || 0}개 항목 반환`
      );
      return response.data || [];
    } catch (error) {
      logger.error(`스레드 목록 조회 오류: ${error.message}`);
      throw error;
    }
  }

  /**
   * 스레드 상세 조회
   * @param {string} threadId - 스레드 ID
   * @returns {Promise<Object>} - 스레드 정보
   */
  async getThread(threadId) {
    try {
      logger.info(`스레드 상세 조회, ID: ${threadId}`);

      const fields =
        "id,media_product_type,media_type,media_url,permalink,text,timestamp,shortcode,thumbnail_url,children,is_quote_post";

      const data = await this._makeRequest("GET", threadId, {
        fields,
      });

      logger.info(`스레드 상세 조회 완료, ID: ${threadId}`);
      return data;
    } catch (error) {
      logger.error(`스레드 상세 조회 오류: ${error.message}`);
      throw error;
    }
  }

  /**
   * 스레드 인사이트 조회
   * @param {string} threadId - 스레드 ID
   * @returns {Promise<Object>} - 인사이트 정보
   */
  async getThreadInsights(threadId) {
    try {
      logger.info(`스레드 인사이트 조회, ID: ${threadId}`);

      const data = await this._makeRequest("GET", `${threadId}/insights`, {
        metric: "views,likes,replies,reposts,quotes",
      });

      logger.info(`스레드 인사이트 조회 완료, ID: ${threadId}`);
      return data;
    } catch (error) {
      logger.error(`스레드 인사이트 조회 오류: ${error.message}`);
      throw error;
    }
  }

  /**
   * 사용자 인사이트 조회
   * @returns {Promise<Object>} - 사용자 인사이트 정보
   */
  async getUserInsights() {
    try {
      logger.info(`사용자 인사이트 조회, 사용자 ID: ${this.userId}`);

      const data = await this._makeRequest("GET", "threads_insights", {
        metric: "views,likes,replies,reposts,quotes,followers_count",
      });

      logger.info("사용자 인사이트 조회 완료");
      return data;
    } catch (error) {
      logger.error(`사용자 인사이트 조회 오류: ${error.message}`);
      throw error;
    }
  }

  /**
   * 액세스 토큰 정보 확인
   * @returns {Promise<Object>} - 토큰 정보
   */
  async checkAccessToken() {
    try {
      logger.info("스레드 액세스 토큰 정보 확인");

      const url = `${this.facebookUrl}/debug_token`;

      const data = await this._makeRequest("GET", url, {
        input_token: this.accessToken,
      });

      if (!data.data) {
        throw new Error("토큰 정보를 받지 못했습니다");
      }

      const tokenData = data.data;
      const expiresAt = tokenData.expires_at
        ? new Date(tokenData.expires_at * 1000)
        : null;

      logger.info(
        `토큰 정보 확인 완료, 만료일: ${expiresAt?.toISOString() || "영구"}`
      );

      // 만료 임박 경고
      if (expiresAt && expiresAt - new Date() < 7 * 24 * 60 * 60 * 1000) {
        logger.warn(`토큰이 7일 이내에 만료됩니다: ${expiresAt.toISOString()}`);
      }

      return tokenData;
    } catch (error) {
      logger.error(`토큰 정보 확인 오류: ${error.message}`);
      throw error;
    }
  }

  /**
   * 통계 데이터 조회 및 가공
   * @returns {Promise<Object>} - 통계 정보
   */
  async getStatistics() {
    try {
      logger.info("스레드 통계 정보 조회 시작");

      // 1. 사용자의 스레드 목록 조회
      const threads = await this.getUserThreads(20);

      // 2. 게시물 유형 통계
      const postTypes = {
        TEXT: 0,
        IMAGE: 0,
        VIDEO: 0,
        MIXED: 0,
      };

      // 3. 참여도 통계용 데이터
      let totalLikes = 0;
      let totalReplies = 0;
      let totalReposts = 0;
      let totalQuotes = 0;
      let totalViews = 0;

      // 4. 스레드별 인사이트 조회 및 통계 계산
      for (const thread of threads) {
        // 게시물 유형 집계
        const mediaType = thread.media_type || "TEXT";
        if (postTypes[mediaType] !== undefined) {
          postTypes[mediaType]++;
        } else if (thread.children?.length > 0) {
          postTypes.MIXED++;
        } else {
          postTypes.TEXT++;
        }

        // 인사이트 조회 (선택적으로 수행 - API 호출 횟수 제한 있을 수 있음)
        try {
          const insight = await this.getThreadInsights(thread.id);

          totalLikes += insight.likes?.value || 0;
          totalReplies += insight.replies?.value || 0;
          totalReposts += insight.reposts?.value || 0;
          totalQuotes += insight.quotes?.value || 0;
          totalViews += insight.views?.value || 0;
        } catch (insightError) {
          logger.warn(
            `스레드 인사이트 조회 실패 (ID: ${thread.id}): ${insightError.message}`
          );
        }
      }

      // 5. 사용자 인사이트 조회 (전체 통계)
      let userInsights = {};
      try {
        userInsights = await this.getUserInsights();
      } catch (userInsightError) {
        logger.warn(`사용자 인사이트 조회 실패: ${userInsightError.message}`);
      }

      // 6. 통계 결과 구성
      const statistics = {
        total_threads: threads.length,
        post_types: postTypes,
        engagement: {
          views: totalViews || userInsights.views?.value || 0,
          likes: totalLikes || userInsights.likes?.value || 0,
          replies: totalReplies || userInsights.replies?.value || 0,
          reposts: totalReposts || userInsights.reposts?.value || 0,
          quotes: totalQuotes || userInsights.quotes?.value || 0,
        },
        followers_count: userInsights.followers_count?.value || 0,
      };

      logger.info("스레드 통계 정보 조회 완료");
      return statistics;
    } catch (error) {
      logger.error(`스레드 통계 정보 조회 오류: ${error.message}`);
      throw error;
    }
  }
}

module.exports = ThreadService;
