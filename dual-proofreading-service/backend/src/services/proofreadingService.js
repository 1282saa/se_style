// src/services/proofreadingService.js
const mongoose = require("mongoose");
const Article = require("../models/article.model");
const Correction = require("../models/correction.model");
const UserChoice = require("../models/userChoice.model");
const styleGuideService = require("./styleGuideService");
const claudeService = require("./llm/claudeService"); // anthropicService를 claudeService로 통합
const promptService = require("./llm/promptService");
const logger = require("../utils/logger");
const config = require("../config");

/**
 * 교정 서비스
 * - 사용자 기사 교정 및 결과 관리
 * - 다양한 교정 스타일 제공 (최소, 적극적, 맞춤형)
 */
class ProofreadingService {
  /**
   * 새 기사를 생성합니다.
   * @param {Object} articleData - 기사 데이터
   * @returns {Promise<Object>} - 생성된 기사 객체
   */
  async createArticle(articleData) {
    try {
      // 기본값 설정 및 유효성 검사
      if (!articleData.originalText) {
        throw new Error("원문 텍스트가 제공되지 않았습니다");
      }

      // 텍스트 길이 제한 검사
      if (articleData.originalText.length > config.MAX_TEXT_LENGTH) {
        throw new Error(
          `텍스트 길이가 너무 깁니다. ${config.MAX_TEXT_LENGTH}자 이하로 입력해주세요.`
        );
      }

      const article = new Article({
        userId: articleData.userId || "anonymous",
        originalText: articleData.originalText,
        topic: articleData.topic || "일반",
        category: articleData.category || "기타",
        metadata: articleData.metadata || {},
      });

      // 기사 저장
      const savedArticle = await article.save();
      logger.info(`새 기사 생성 완료 (ID: ${savedArticle._id})`);

      return savedArticle;
    } catch (error) {
      logger.error(`기사 생성 오류: ${error.message}`);
      throw new Error(`기사 생성 중 오류 발생: ${error.message}`);
    }
  }

  /**
   * 특정 기사를 교정합니다.
   * @param {string} articleId - 기사 ID
   * @returns {Promise<Array>} - 교정 결과 배열 [최소 교정, 적극적 교정]
   */
  async proofreadArticle(articleId) {
    try {
      // 기사 조회
      const article = await this.findArticleById(articleId);

      // 관련 스타일 가이드 검색
      const styleGuides = await this.findRelatedStyleGuides(
        article.originalText
      );

      // 두 가지 교정 결과 생성 (병렬 처리)
      const [correction1, correction2] = await Promise.all([
        this.generateCorrection(article, styleGuides, 1),
        this.generateCorrection(article, styleGuides, 2),
      ]);

      return [correction1, correction2];
    } catch (error) {
      logger.error(`기사 교정 오류: ${error.message}`);
      throw new Error(`기사 교정 중 오류 발생: ${error.message}`);
    }
  }

  /**
   * ID로 기사를 조회합니다.
   * @param {string} articleId - 기사 ID
   * @returns {Promise<Object>} - 찾은 기사 객체
   * @private
   */
  async findArticleById(articleId) {
    const article = await Article.findById(articleId);
    if (!article) {
      throw new Error(`기사를 찾을 수 없습니다 (ID: ${articleId})`);
    }
    return article;
  }

  /**
   * 텍스트와 관련된 스타일 가이드를 검색합니다.
   * @param {string} text - 검색할 텍스트
   * @returns {Promise<Array>} - 관련 스타일 가이드 배열
   * @private
   */
  async findRelatedStyleGuides(text) {
    const styleGuides = await styleGuideService.findRelatedStyleGuides(text);
    logger.info(`관련 스타일 가이드 ${styleGuides.length}개 발견`);
    return styleGuides;
  }

  /**
   * 지정된 프롬프트 유형으로 교정 결과를 생성합니다.
   * @param {Object} article - 기사 객체
   * @param {Array} styleGuides - 관련 스타일 가이드
   * @param {number} promptType - 프롬프트 유형 (1: 최소, 2: 적극적, 3: 맞춤형)
   * @param {Object} preferences - 사용자 선호도 설정 (맞춤형 교정 시 사용)
   * @returns {Promise<Object>} - 교정 결과 객체
   */
  async generateCorrection(article, styleGuides, promptType, preferences = {}) {
    try {
      // 1. 교정 결과가 이미 존재하는지 확인
      const existingCorrection = await this.findExistingCorrection(
        article._id,
        promptType,
        preferences
      );
      if (existingCorrection) {
        return existingCorrection;
      }

      // 2. 프롬프트 생성
      const prompt = this.createPrompt(
        article.originalText,
        styleGuides,
        promptType,
        preferences
      );

      // 3. 캐시 키 생성
      const cacheKey = this.generateCacheKey(
        article._id,
        promptType,
        styleGuides,
        preferences
      );

      // 4. Claude API 호출
      const result = await this.callClaudeAPI(prompt, cacheKey);

      // 5. 교정 결과 저장
      return await this.saveCorrection(article._id, promptType, result);
    } catch (error) {
      logger.error(
        `교정 생성 오류 (프롬프트 유형: ${promptType}): ${error.message}`
      );

      // 오류 발생 시 대체 교정 생성
      return this.createFallbackCorrection(article, promptType);
    }
  }

  /**
   * 기존 교정 결과를 찾습니다.
   * @param {string} articleId - 기사 ID
   * @param {number} promptType - 프롬프트 유형
   * @param {Object} preferences - 사용자 선호도 설정 (맞춤형 교정 시 사용)
   * @returns {Promise<Object|null>} - 기존 교정 결과 또는 null
   * @private
   */
  async findExistingCorrection(articleId, promptType, preferences = {}) {
    // 기본 쿼리
    const query = { articleId, promptType };

    // 맞춤형 교정인 경우 (promptType === 3) 추가 필터링 고려
    if (promptType === 3 && Object.keys(preferences).length > 0) {
      // 선호도 설정을 메타데이터에 저장했다면 해당 필드로 추가 필터링
      // 이 부분은 데이터 모델에 따라 조정 필요
    }

    const existingCorrection = await Correction.findOne(query);

    if (existingCorrection) {
      logger.info(`기존 교정 결과 반환 (ID: ${existingCorrection._id})`);
      return existingCorrection;
    }

    return null;
  }

  /**
   * 적절한 프롬프트를 생성합니다.
   * @param {string} text - 원문 텍스트
   * @param {Array} styleGuides - 관련 스타일 가이드
   * @param {number} promptType - 프롬프트 유형
   * @param {Object} preferences - 사용자 선호도 설정
   * @returns {string} - 생성된 프롬프트
   * @private
   */
  createPrompt(text, styleGuides, promptType, preferences = {}) {
    if (promptType === 3) {
      return promptService.generateCustomPrompt(text, styleGuides, preferences);
    } else {
      return promptService.generatePrompt(promptType, text, styleGuides);
    }
  }

  /**
   * 캐시 키를 생성합니다.
   * @param {string} articleId - 기사 ID
   * @param {number} promptType - 프롬프트 유형
   * @param {Array} styleGuides - 관련 스타일 가이드
   * @param {Object} preferences - 사용자 선호도 설정
   * @returns {string} - 생성된 캐시 키
   * @private
   */
  generateCacheKey(articleId, promptType, styleGuides, preferences = {}) {
    if (promptType === 3 && Object.keys(preferences).length > 0) {
      // 맞춤형 교정일 경우 선호도 정보 포함
      const preferencesKey = JSON.stringify(preferences).substring(0, 50);
      return `custom:${articleId}:${preferencesKey}`;
    } else {
      // 기본 교정일 경우
      return `correction:${articleId}:${promptType}:${styleGuides.length}`;
    }
  }

  /**
   * Claude API를 호출합니다.
   * @param {string} prompt - 프롬프트
   * @param {string} cacheKey - 캐시 키
   * @returns {Promise<Object>} - API 응답 결과
   * @private
   */
  async callClaudeAPI(prompt, cacheKey) {
    return await claudeService.proofread(prompt, {
      cacheKey,
      model: config.CLAUDE_MODEL,
    });
  }

  /**
   * 교정 결과를 저장합니다.
   * @param {string} articleId - 기사 ID
   * @param {number} promptType - 프롬프트 유형
   * @param {Object} result - API 응답 결과
   * @returns {Promise<Object>} - 저장된 교정 결과
   * @private
   */
  async saveCorrection(articleId, promptType, result) {
    // 결과에서 필요한 데이터 추출
    const correctedText = result.correctedText || "";
    const corrections = result.corrections || [];
    const metadata = result.metadata || {};

    // 교정 결과 객체 생성
    const correction = new Correction({
      articleId,
      promptType,
      correctedText,
      changes: corrections.map((c) => ({
        ruleId: c.ruleId,
        original: c.originalText,
        suggestion: c.correctedText,
        explanation: c.explanation,
        priority: c.priority || 3,
        confidence: c.confidence || 0.8,
      })),
      llmInfo: {
        model: metadata.model || config.CLAUDE_MODEL,
        promptTokens: metadata.promptTokens || 0,
        completionTokens: metadata.completionTokens || 0,
        totalTokens: metadata.totalTokens || 0,
      },
    });

    // 저장 및 반환
    const savedCorrection = await correction.save();
    logger.info(`교정 결과 저장 완료 (ID: ${savedCorrection._id})`);

    return savedCorrection;
  }

  /**
   * 오류 발생 시 대체 교정 결과를 생성합니다.
   * @param {Object} article - 기사 객체
   * @param {number} promptType - 프롬프트 유형
   * @returns {Promise<Object>} - 대체 교정 결과
   * @private
   */
  async createFallbackCorrection(article, promptType) {
    try {
      logger.info("대체 교정 결과 생성 시도");

      // 기본 교정 객체 생성
      const fallbackCorrection = new Correction({
        articleId: article._id,
        promptType,
        correctedText: article.originalText, // 오류 시 원문 그대로 반환
        changes: [],
        llmInfo: {
          model: "fallback",
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
        },
      });

      // 저장 및 반환
      const savedFallback = await fallbackCorrection.save();
      logger.info(`대체 교정 결과 저장 완료 (ID: ${savedFallback._id})`);

      return savedFallback;
    } catch (fallbackError) {
      // 대체 교정 생성마저 실패한 경우
      logger.error(`대체 교정 생성 실패: ${fallbackError.message}`);
      throw new Error(`교정 생성 중 오류 발생: ${fallbackError.message}`);
    }
  }

  /**
   * 사용자의 선택을 저장합니다.
   * @param {string} articleId - 기사 ID
   * @param {string} correctionId - 선택한 교정 결과 ID
   * @param {Object} feedbackData - 피드백 데이터 (별점, 코멘트 등)
   * @returns {Promise<Object>} - 저장된 선택 객체
   */
  async saveUserChoice(articleId, correctionId, feedbackData = {}) {
    try {
      // 기사와 교정 결과 존재 여부 확인
      const [article, correction] = await Promise.all([
        this.findArticleById(articleId),
        this.findCorrectionById(correctionId),
      ]);

      // 교정 결과와 기사의 연결 확인
      this.validateCorrectionArticleMatch(article, correction);

      // 이전 선택 여부 확인
      const existingChoice = await UserChoice.findOne({ articleId });

      // 이전 선택이 있으면 업데이트, 없으면 새로 생성
      if (existingChoice) {
        return await this.updateUserChoice(
          existingChoice,
          correction,
          feedbackData
        );
      } else {
        return await this.createUserChoice(articleId, correction, feedbackData);
      }
    } catch (error) {
      logger.error(`사용자 선택 저장 오류: ${error.message}`);
      throw new Error(`사용자 선택 저장 중 오류 발생: ${error.message}`);
    }
  }

  /**
   * ID로 교정 결과를 조회합니다.
   * @param {string} correctionId - 교정 결과 ID
   * @returns {Promise<Object>} - 찾은 교정 결과 객체
   * @private
   */
  async findCorrectionById(correctionId) {
    const correction = await Correction.findById(correctionId);
    if (!correction) {
      throw new Error(`교정 결과를 찾을 수 없습니다 (ID: ${correctionId})`);
    }
    return correction;
  }

  /**
   * 교정 결과와 기사의 연결을 확인합니다.
   * @param {Object} article - 기사 객체
   * @param {Object} correction - 교정 결과 객체
   * @private
   */
  validateCorrectionArticleMatch(article, correction) {
    if (!correction.articleId.equals(article._id)) {
      throw new Error("교정 결과가 해당 기사와 연결되어 있지 않습니다");
    }
  }

  /**
   * 기존 사용자 선택을 업데이트합니다.
   * @param {Object} existingChoice - 기존 선택 객체
   * @param {Object} correction - 교정 결과 객체
   * @param {Object} feedbackData - 피드백 데이터
   * @returns {Promise<Object>} - 업데이트된 선택 객체
   * @private
   */
  async updateUserChoice(existingChoice, correction, feedbackData) {
    // 선택된 프롬프트 유형 업데이트
    existingChoice.selectedPromptType = correction.promptType;

    // 피드백 데이터 업데이트
    if (feedbackData.rating !== undefined) {
      existingChoice.rating = feedbackData.rating;
    }

    if (feedbackData.comment) {
      existingChoice.comment = feedbackData.comment;
    }

    // 저장 및 반환
    const updatedChoice = await existingChoice.save();
    logger.info(`사용자 선택 업데이트 완료 (ID: ${updatedChoice._id})`);

    return updatedChoice;
  }

  /**
   * 새 사용자 선택을 생성합니다.
   * @param {string} articleId - 기사 ID
   * @param {Object} correction - 교정 결과 객체
   * @param {Object} feedbackData - 피드백 데이터
   * @returns {Promise<Object>} - 새 선택 객체
   * @private
   */
  async createUserChoice(articleId, correction, feedbackData) {
    // 새 선택 객체 생성
    const userChoice = new UserChoice({
      articleId,
      selectedPromptType: correction.promptType,
      rating: feedbackData.rating !== undefined ? feedbackData.rating : null,
      comment: feedbackData.comment || "",
    });

    // 저장 및 반환
    const savedChoice = await userChoice.save();
    logger.info(`새 사용자 선택 저장 완료 (ID: ${savedChoice._id})`);

    return savedChoice;
  }

  /**
   * 간편 교정을 수행합니다. (기사 생성 및 교정을 한 번에 처리)
   * @param {string} text - 교정할 텍스트
   * @param {string} userId - 사용자 ID
   * @param {Object} metadata - 메타데이터
   * @returns {Promise<Object>} - 교정 결과
   */
  async quickProofread(text, userId = "anonymous", metadata = {}) {
    try {
      // 텍스트 길이 제한 검사는 createArticle 내부에서 처리됨

      // 1. 새 기사 생성
      const article = await this.createArticle({
        userId,
        originalText: text,
        metadata,
      });

      // 2. 관련 스타일 가이드 검색
      const styleGuides = await this.findRelatedStyleGuides(text);

      // 3. 두 가지 교정 결과 생성 (병렬 처리)
      const [correction1, correction2] = await Promise.all([
        this.generateCorrection(article, styleGuides, 1),
        this.generateCorrection(article, styleGuides, 2),
      ]);

      // 4. 결과 포맷팅하여 반환
      return this.formatProofreadResult(
        article,
        [correction1, correction2],
        styleGuides
      );
    } catch (error) {
      logger.error(`간편 교정 오류: ${error.message}`);
      throw new Error(`간편 교정 중 오류 발생: ${error.message}`);
    }
  }

  /**
   * 교정 결과를 포맷팅합니다.
   * @param {Object} article - 기사 객체
   * @param {Array} corrections - 교정 결과 배열
   * @param {Array} styleGuides - 스타일 가이드 배열
   * @returns {Object} - 포맷팅된 결과
   * @private
   */
  formatProofreadResult(article, corrections, styleGuides) {
    return {
      articleId: article._id,
      original: article.originalText,
      corrections: corrections.map((c, index) => ({
        id: c._id,
        promptType: c.promptType,
        text: c.correctedText,
        type: index === 0 ? "minimal" : "enhanced",
        changes: c.changes,
      })),
      styleGuides: styleGuides.map((guide) => ({
        id: guide._id,
        section: guide.section,
        category: guide.category,
      })),
    };
  }

  /**
   * 특정 기사의 교정 결과를 조회합니다.
   * @param {string} articleId - 기사 ID
   * @returns {Promise<Array>} - 교정 결과 배열
   */
  async getArticleCorrections(articleId) {
    try {
      // 기사 존재 여부 확인
      await this.findArticleById(articleId);

      // 교정 결과 조회
      const corrections = await Correction.find({ articleId });

      return corrections;
    } catch (error) {
      logger.error(`교정 결과 조회 오류: ${error.message}`);
      throw new Error(`교정 결과 조회 중 오류 발생: ${error.message}`);
    }
  }

  /**
   * 이전 교정 결과 기반으로 사용자 맞춤형 교정을 수행합니다.
   * @param {string} articleId - 기사 ID
   * @param {Object} preferences - 사용자 선호도 설정
   * @returns {Promise<Object>} - 맞춤형 교정 결과
   */
  async generateCustomCorrection(articleId, preferences = {}) {
    try {
      // 기사 조회
      const article = await this.findArticleById(articleId);

      // 관련 스타일 가이드 검색
      const styleGuides = await this.findRelatedStyleGuides(
        article.originalText
      );

      // 맞춤형 교정 생성 (프롬프트 유형 3)
      const correction = await this.generateCorrection(
        article,
        styleGuides,
        3,
        preferences
      );

      // 결과 포맷팅하여 반환
      return {
        id: correction._id,
        articleId: article._id,
        text: correction.correctedText,
        type: "custom",
        changes: correction.changes,
      };
    } catch (error) {
      logger.error(`맞춤형 교정 생성 오류: ${error.message}`);
      throw new Error(`맞춤형 교정 생성 중 오류 발생: ${error.message}`);
    }
  }
}

module.exports = new ProofreadingService();
