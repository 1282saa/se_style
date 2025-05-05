const axios = require("axios");
const logger = require("../../utils/logger");

/**
 * 인스타그램 API 서비스
 */
class InstagramService {
  /**
   * 인스타그램 서비스 초기화
   * @param {Object} credentials - 인증 정보
   */
  constructor(credentials) {
    this.accessToken = credentials.accessToken;
    this.userId = credentials.platformUserId; // Instagram 비즈니스 계정 ID
    this.baseUrl = "https://graph.instagram.com/v19.0"; // 최신 API 버전 사용
    this.facebookUrl = "https://graph.facebook.com/v19.0"; // Facebook Graph API URL

    if (!this.accessToken) {
      throw new Error("인스타그램 엑세스 토큰이 필요합니다");
    }

    if (!this.userId) {
      throw new Error("인스타그램 비즈니스 계정 ID가 필요합니다");
    }

    logger.info(`인스타그램 서비스 초기화 (userId: ${this.userId})`);
  }

  /**
   * API 요청 전송 유틸리티 메서드
   * @private
   * @param {string} method - HTTP 메서드
   * @param {string} url - 요청 URL
   * @param {Object} params - 요청 파라미터
   * @param {Object} data - 요청 바디 데이터
   * @returns {Promise<Object>} - API 응답
   */
  async _request(method, url, params = {}, data = null) {
    try {
      // 액세스 토큰 추가
      const requestParams = { ...params, access_token: this.accessToken };

      logger.debug(`인스타그램 API 요청: ${method.toUpperCase()} ${url}`);

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
      logger.error(`인스타그램 API 오류: ${error.message}`);

      // 상세 오류 로깅
      if (axios.isAxiosError(error) && error.response) {
        const { status, data } = error.response;
        logger.error(`API 응답 코드: ${status}`);
        logger.error(`API 응답 데이터: ${JSON.stringify(data)}`);

        // Facebook/Instagram API 오류 메시지 추출
        const errorMessage = data.error?.message || "알 수 없는 오류";
        const errorType = data.error?.type || "UnknownError";
        const errorCode = data.error?.code || 0;

        throw new Error(
          `인스타그램 API 오류 (${errorType} ${errorCode}): ${errorMessage}`
        );
      }

      throw error;
    }
  }

  /**
   * 이미지 미디어 컨테이너 생성
   * @param {string} imageUrl - 이미지 URL (공개적으로 접근 가능한 HTTPS URL이어야 함)
   * @param {string} caption - 게시물 설명
   * @returns {Promise<string>} - 생성된 컨테이너 ID
   */
  async createMediaContainer(imageUrl, caption) {
    try {
      logger.info("이미지 컨테이너 생성 시작");
      logger.debug(`이미지 URL: ${imageUrl}`);
      logger.debug(`캡션 길이: ${caption.length}자`);

      // 캡션이 2200자를 초과하는지 확인 (Instagram 제한)
      if (caption.length > 2200) {
        logger.warn(
          `캡션이 너무 깁니다: ${caption.length}자. 2200자로 제한합니다.`
        );
        caption = caption.substring(0, 2196) + "...";
      }

      const url = `${this.facebookUrl}/${this.userId}/media`;

      const data = await this._request("post", url, {
        image_url: imageUrl,
        caption: caption,
      });

      if (!data.id) {
        throw new Error("미디어 컨테이너 ID를 받지 못했습니다");
      }

      logger.info(`이미지 컨테이너 생성 완료, ID: ${data.id}`);
      return data.id;
    } catch (error) {
      logger.error(`이미지 컨테이너 생성 실패: ${error.message}`);
      throw error;
    }
  }

  /**
   * 미디어 컨테이너를 Instagram에 게시
   * @param {string} containerId - 미디어 컨테이너 ID
   * @returns {Promise<Object>} - 게시 결과
   */
  async publishContainer(containerId) {
    try {
      logger.info(`컨테이너 게시 시작, ID: ${containerId}`);

      const url = `${this.facebookUrl}/${this.userId}/media_publish`;

      const data = await this._request("post", url, {
        creation_id: containerId,
      });

      if (!data.id) {
        throw new Error("게시물 ID를 받지 못했습니다");
      }

      logger.info(`게시물 게시 완료, ID: ${data.id}`);

      // 게시물 정보 반환
      return {
        id: data.id,
        permalink: `https://www.instagram.com/p/${data.id}/`,
      };
    } catch (error) {
      logger.error(`컨테이너 게시 실패: ${error.message}`);
      throw error;
    }
  }

  /**
   * 인스타그램에 게시
   * @param {string} text - 게시할 텍스트
   * @param {string} mediaUrl - 이미지/비디오 URL (필수)
   * @returns {Promise<Object>} - 게시 결과
   */
  async publish(text, mediaUrl = null) {
    try {
      logger.info(`인스타그램에 게시 시도: 텍스트 길이 ${text.length}자`);

      if (!mediaUrl) {
        throw new Error("인스타그램은 이미지 없이 게시할 수 없습니다");
      }

      // 1. 이미지 컨테이너 생성
      const containerId = await this.createMediaContainer(mediaUrl, text);

      // 2. 컨테이너 생성 후 약간의 대기 시간 (권장)
      await new Promise((resolve) => setTimeout(resolve, 5000));

      // 3. 컨테이너 게시
      const publishResult = await this.publishContainer(containerId);

      logger.info(`인스타그램 게시 성공, 게시물 ID: ${publishResult.id}`);
      return publishResult;
    } catch (error) {
      logger.error(`인스타그램 게시 오류: ${error.message}`);
      if (axios.isAxiosError(error)) {
        logger.error(`API 응답: ${JSON.stringify(error.response?.data || {})}`);
      }
      throw error;
    }
  }

  /**
   * 인스타그램 미디어 조회
   * @param {number} limit - 조회할 최대 항목 수
   * @returns {Promise<Array>} - 미디어 목록
   */
  async getMedia(limit = 10) {
    try {
      logger.info(`인스타그램 미디어 조회, 최대 ${limit}개`);

      const fields =
        "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,username";
      const url = `${this.baseUrl}/me/media`;

      const data = await this._request("get", url, {
        fields,
        limit,
      });

      logger.info(`미디어 조회 완료, ${data.data?.length || 0}개 항목 반환`);
      return data.data || [];
    } catch (error) {
      logger.error(`인스타그램 미디어 조회 오류: ${error.message}`);
      throw error;
    }
  }

  /**
   * 사용자 정보 조회
   * @returns {Promise<Object>} - 사용자 정보
   */
  async getUserInfo() {
    try {
      logger.info("인스타그램 사용자 정보 조회");

      const fields = "id,username,account_type,media_count";
      const url = `${this.baseUrl}/me`;

      const data = await this._request("get", url, { fields });

      logger.info(`사용자 정보 조회 완료, 사용자명: ${data.username}`);
      return data;
    } catch (error) {
      logger.error(`인스타그램 사용자 정보 조회 오류: ${error.message}`);
      throw error;
    }
  }

  /**
   * 인스타그램 통계 정보 조회
   * @param {number} limit - 조회할 최대 항목 수
   * @returns {Promise<Object>} - 통계 정보
   */
  async getUserStatistics(limit = 30) {
    try {
      // 미디어 항목 가져오기
      const mediaItems = await this.getMedia(limit);

      // 게시물 유형 분석
      const postTypes = { IMAGE: 0, VIDEO: 0, CAROUSEL_ALBUM: 0 };

      // 해시태그 빈도 분석
      const hashtags = {};

      // 시간대별 게시 빈도 분석
      const postingHours = {};
      for (let i = 0; i < 24; i++) {
        postingHours[i] = 0;
      }

      // 각 미디어 항목 분석
      for (const item of mediaItems) {
        // 게시물 유형 집계
        const mediaType = item.media_type || "IMAGE";
        if (postTypes[mediaType] !== undefined) {
          postTypes[mediaType]++;
        }

        // 캡션에서 해시태그 추출 및 집계
        const caption = item.caption || "";
        const hashtagMatches = caption.match(/#[\w가-힣]+/g) || [];

        for (const tag of hashtagMatches) {
          const cleanTag = tag.substring(1).toLowerCase(); // # 제거 및 소문자 변환
          hashtags[cleanTag] = (hashtags[cleanTag] || 0) + 1;
        }

        // 게시 시간 분석
        if (item.timestamp) {
          try {
            const postDate = new Date(item.timestamp);
            const hour = postDate.getHours();
            postingHours[hour]++;
          } catch (error) {
            logger.warn(`날짜 파싱 오류: ${error.message}`);
          }
        }
      }

      // 인기 해시태그 정렬
      const popularHashtags = Object.entries(hashtags)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

      // 인기 게시 시간 정렬
      const peakPostingHours = Object.entries(postingHours)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);

      return {
        total_posts: mediaItems.length,
        post_types: postTypes,
        popular_hashtags: popularHashtags,
        peak_posting_hours: peakPostingHours,
      };
    } catch (error) {
      logger.error(`인스타그램 통계 조회 오류: ${error.message}`);
      throw error;
    }
  }

  /**
   * 액세스 토큰 정보 확인
   * @returns {Promise<Object>} - 토큰 정보
   */
  async checkAccessToken() {
    try {
      logger.info("인스타그램 액세스 토큰 정보 확인");

      const url = `${this.facebookUrl}/debug_token`;

      const data = await this._request("get", url, {
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
}

module.exports = InstagramService;
