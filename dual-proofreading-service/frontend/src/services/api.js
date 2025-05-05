import axios from "axios";

// API 기본 설정
const API_URL = "http://localhost:3003/api"; // 하드코딩으로 3003 포트 지정

// axios 인스턴스 생성
const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// 인터셉터 설정 (에러 처리, 인증 등)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const { response } = error;

    // 에러 응답 처리
    if (response) {
      console.error("API 오류:", response.status, response.data);
    } else {
      console.error("네트워크 오류:", error.message);
    }

    return Promise.reject(error);
  }
);

// 기사 관련 API 함수
export const articleApi = {
  // 새 교열 요청 생성
  createArticle: (articleData) => api.post("/articles", articleData),

  // 특정 교열 요청 조회
  getArticle: (id) => api.get(`/articles/${id}`),

  // 기사 교열 실행
  proofreadArticle: (id) => api.post(`/articles/${id}/proofread`),

  // 교열 결과 조회
  getCorrections: (id) => api.get(`/articles/${id}/corrections`),

  // 사용자 선택 저장
  saveUserChoice: (id, choiceData) =>
    api.post(`/articles/${id}/choice`, choiceData),

  // 사용자별 교열 요청 목록 조회
  getUserArticles: (userId, page = 1, limit = 10) =>
    api.get(`/articles/user/${userId}`, {
      params: { page, limit },
    }),
};

// 스타일 가이드 관련 API 함수
export const styleGuideApi = {
  // 스타일 가이드 항목 추가
  createStyleGuide: (styleGuideData) =>
    api.post("/styleguides", styleGuideData),

  // 스타일 가이드 목록 조회
  getStyleGuides: (params) => api.get("/styleguides", { params }),

  // 스타일 가이드 항목 수정
  updateStyleGuide: (id, styleGuideData) =>
    api.put(`/styleguides/${id}`, styleGuideData),

  // 스타일 가이드 항목 삭제
  deleteStyleGuide: (id) => api.delete(`/styleguides/${id}`),

  // 시맨틱 검색 - 텍스트 내용 기반 유사 스타일 가이드 검색
  searchSemantic: (query, limit = 5, category = null) => {
    const data = { query, limit };
    if (category) data.category = category;
    return api.post("/styleguides/search-semantic", data);
  },
};

// 소셜 미디어 관련 API 함수
export const socialMediaApi = {
  // 연결된 소셜 미디어 계정 목록 조회
  getConnectedAccounts: (userId) =>
    api.get("/social/accounts", { params: { userId } }),

  // 소셜 미디어 계정 연결
  connectAccount: (platform, credentials) =>
    api.post(`/social/connect/${platform}`, credentials),

  // 소셜 미디어 게시물 생성
  generatePost: (articleId, data) =>
    api.post("/social/generate", { articleId, ...data }),

  // 소셜 미디어에 게시
  publishPost: (postId, userId) =>
    api.post(`/social/publish/${postId}`, { userId }),

  // 사용자의 소셜 미디어 포스트 목록 조회
  getUserPosts: (userId, platform, status, page = 1, limit = 10) =>
    api.get("/social/posts", {
      params: { userId, platform, status, page, limit },
    }),

  // 소셜 미디어 플랫폼별 통계 조회
  getPlatformStatistics: (platform, userId) =>
    api.get("/social/statistics", { params: { platform, userId } }),

  // 소셜 미디어 통계 조회 (모든 플랫폼 또는 특정 플랫폼)
  getStatistics: (userId, platform = null) =>
    api.get("/social/statistics", {
      params: { userId, platform },
    }),
};

// 분석 관련 API 함수
export const analyticsApi = {
  // 프롬프트별 성능 분석
  getPromptPerformance: (timeRange) =>
    api.get("/analytics/prompt-performance", {
      params: { timeRange },
    }),

  // 사용자별 선호도 분석
  getUserPreferences: (userId) =>
    api.get(`/analytics/user/${userId}/preferences`),
};

export default {
  articleApi,
  styleGuideApi,
  analyticsApi,
  socialMediaApi,
};
