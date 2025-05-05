// src/services/proofreadingService.js
const mongoose = require("mongoose");
const Article = require("../models/article.model");
const Correction = require("../models/correction.model");
const UserChoice = require("../models/userChoice.model");
const styleGuideService = require("./styleGuideService");
const anthropicService = require("./llm/anthropicService"); // anthropicService를 anthropicService 통합
const logger = require("../utils/logger");
const { extractChanges, calculateStats } = require("../utils/textAnalysis");
const cache = require("../utils/cache");
const { findRelevantStyleguides } = require("./rag/vectorSearch");
const { selectPrompt } = require("./llm/promptSelector");
const { buildPrompt, buildEnhancedPrompt } = require("./llm/promptBuilder");
const promptService = require("./llm/promptService");
const knowledgeService = require("./knowledgeService");
const config = require("../config");

/**
 * 교정 서비스
 * - 사용자 기사 교정 및 결과 관리
 * - 다양한 교정 스타일 제공 (최소, 적극적, 맞춤형)
 */
class ProofreadingService {
  /**
   * 빠른 교정을 수행합니다. (기사 생성 및 교정을 한 번에 처리)
   * @param {string} text - 교정할 텍스트
   * @param {string} userId - 사용자 ID
   * @param {Object} metadata - 메타데이터
   * @returns {Promise<Object>} - 교정 결과
   */
  async quickProofread(text, userId = "anonymous", metadata = {}) {
    try {
      logger.info(
        `빠른 교정 요청: 텍스트 길이 ${text.length}자, 사용자 ${userId}`
      );

      // 1. 임시 기사 생성
      const article = await this.createArticle(text, userId, metadata);

      // 2. 관련 스타일가이드 검색 (styleGuideService의 함수 호출로 수정)
      const styleGuides = await styleGuideService.findRelatedStyleguides(text);
      logger.info(`관련 스타일가이드 ${styleGuides.length}개 검색 완료`);

      // 3. 두 종류 교정 생성
      const [minimal, enhanced] = await Promise.all([
        this.generateCorrection(article._id, text, 1, styleGuides), // 최소 교정
        this.generateCorrection(article._id, text, 2, styleGuides), // 적극적 교정
      ]);

      // 4. 결과 반환
      return {
        articleId: article._id,
        original: text,
        corrections: [minimal, enhanced],
      };
    } catch (error) {
      logger.error(`빠른 교정 오류: ${error.message}`);
      throw error;
    }
  }

  /**
   * 새 기사를 생성합니다.
   * @param {string} text - 원문 텍스트
   * @param {string} userId - 사용자 ID
   * @param {Object} metadata - 추가 메타데이터
   * @returns {Promise<Object>} - 생성된 기사 객체
   * @private
   */
  async createArticle(text, userId = "anonymous", metadata = {}) {
    try {
      // Article 모델 스키마에 맞게 필드 구성
      const article = new Article({
        userId,
        originalText: text,
        topic: metadata.topic || "일반",
        category: metadata.category || "기타",
        metadata: metadata.additionalInfo || {},
      });

      await article.save();
      logger.info(`기사 생성 완료: ${article._id}`);
      return article;
    } catch (error) {
      logger.error(`기사 생성 오류: ${error.message}`);
      throw error;
    }
  }

  /**
   * 특정 기사를 교정합니다.
   * @param {string} articleId - 기사 ID
   * @param {Object} options - 교정 옵션
   * @returns {Promise<Array>} - 교정 결과 배열 [최소 교정, 적극적 교정]
   */
  async proofreadArticle(articleId, options = {}) {
    try {
      // 기사 조회
      const article = await this.findArticleById(articleId);

      // 관련 스타일 가이드 검색
      const styleGuides = await findRelevantStyleguides(article.originalText);

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
   * 지정된 프롬프트 유형으로 교정 결과를 생성합니다.
   * @param {string} articleId - 기사 ID
   * @param {string} text - 원문 텍스트
   * @param {number|string} promptType - 프롬프트 유형 (1: 최소, 2: 적극적, 3: 맞춤형)
   * @param {Array} styleGuides - 관련 스타일 가이드
   * @returns {Promise<Object>} - 교정 결과 객체
   */
  async generateCorrection(articleId, text, promptType, styleGuides = []) {
    try {
      // 숫자로 통일
      const promptTypeNum = parseInt(promptType, 10);

      if (isNaN(promptTypeNum) || promptTypeNum < 1 || promptTypeNum > 3) {
        logger.warn(`유효하지 않은 promptType: ${promptType}, 기본값 1 사용`);
        promptTypeNum = 1; // 기본값으로 최소 교정 (1) 사용
      }

      // 1. 교정 결과가 이미 존재하는지 확인
      const existingCorrection = await this.findExistingCorrection(
        articleId,
        promptTypeNum,
        styleGuides
      );
      if (existingCorrection) {
        return existingCorrection;
      }

      // 2. 프롬프트 레벨 결정
      const levelMap = {
        1: "minimal",
        2: "enhanced",
        3: "custom",
      };
      const level = levelMap[promptTypeNum] || "minimal";

      // 3. 프롬프트 템플릿 선택
      let promptTemplate;
      try {
        promptTemplate = await selectPrompt({
          level,
          type: "correction",
        });
      } catch (promptError) {
        logger.warn(
          `프롬프트 템플릿 선택 오류: ${promptError.message}, 기본 템플릿 사용`
        );
        // 기본 템플릿 생성
        promptTemplate = {
          template: `당신은 전문 한국어 교정 편집자입니다. 다음 텍스트를 ${
            level === "minimal" ? "최소한으로" : "적극적으로"
          } 교정해주세요:\n\n{{ORIGINAL_TEXT}}\n\n{{KNOWLEDGE_RULES}}\n\n{{STYLE_GUIDES}}\n\n교정 결과:`,
        };
      }

      // 4. 관련 날리지 규칙 검색
      let knowledgeRules = [];
      try {
        // 문서 길이에 따라 가져올 규칙 수 조정
        const maxRules = text.length > 1000 ? 10 : 5;
        knowledgeRules = await knowledgeService.findRelevantRules(text, {
          limit: maxRules,
          minScore: 0.65,
        });

        logger.info(
          `텍스트 관련 날리지 규칙 ${knowledgeRules.length}개 검색됨`
        );
      } catch (knowledgeError) {
        logger.warn(`날리지 규칙 검색 오류: ${knowledgeError.message}`);
      }

      // 5. 향상된 프롬프트 생성
      const fullPrompt = await buildEnhancedPrompt(
        text,
        promptTemplate.template,
        {
          styleGuides,
          includeKnowledge: true,
          maxKnowledgeRules: 7,
          knowledgeRules,
        }
      );

      // 6. 캐시 키 생성 (동일 요청 중복 방지)
      const cacheKey = this.generateCacheKey(
        articleId,
        promptTypeNum,
        styleGuides
      );

      // 7. Claude API 호출
      const result = await this.callClaudeAPI(fullPrompt, text, cacheKey);

      // 8. 교정 결과 저장
      return await this.saveCorrection(
        articleId,
        promptTypeNum,
        result,
        styleGuides
      );
    } catch (error) {
      logger.error(
        `교정 생성 오류 (프롬프트 유형: ${promptType}): ${error.message}`,
        { stack: error.stack }
      );

      // 오류 발생 시 대체 교정 생성
      return this.createFallbackCorrection(articleId, promptType, styleGuides);
    }
  }

  /**
   * 기존 교정 결과를 찾습니다.
   * @param {string} articleId - 기사 ID
   * @param {number} promptType - 프롬프트 유형
   * @param {Array} styleGuides - 관련 스타일 가이드
   * @returns {Promise<Object|null>} - 기존 교정 결과 또는 null
   * @private
   */
  async findExistingCorrection(articleId, promptType, styleGuides = []) {
    // 기본 쿼리
    const query = { articleId, promptType };

    // 스타일 가이드 추가 필터링
    if (styleGuides.length > 0) {
      query.styleGuides = { $all: styleGuides };
    }

    const existingCorrection = await Correction.findOne(query);

    if (existingCorrection) {
      logger.info(`기존 교정 결과 반환 (ID: ${existingCorrection._id})`);
      return existingCorrection;
    }

    return null;
  }

  /**
   * 캐시 키를 생성합니다.
   * @param {string} articleId - 기사 ID
   * @param {number} promptType - 프롬프트 유형
   * @param {Array} styleGuides - 관련 스타일 가이드
   * @returns {string} - 생성된 캐시 키
   * @private
   */
  generateCacheKey(articleId, promptType, styleGuides = []) {
    const styleGuidesStr = styleGuides
      .map((guide) => guide._id.toString())
      .join(",");
    return `correction:${articleId}:${promptType}:${styleGuidesStr}`;
  }

  /**
   * Claude API를 호출합니다.
   * @param {string} prompt - 프롬프트
   * @param {string} originalText - 원문 텍스트 (에러 발생 시 폴백용)
   * @param {string} cacheKey - 캐시 키
   * @returns {Promise<Object>} - API 응답 결과
   * @private
   */
  async callClaudeAPI(prompt, originalText, cacheKey) {
    try {
      // API 호출 로깅
      logger.debug(`Claude API 호출 준비: 프롬프트 길이 ${prompt.length}자`);

      // anthropicService의 proofread 메서드 호출
      const result = await anthropicService.proofread(
        { prompt, textToAnalyze: originalText },
        { cacheKey, model: config.CLAUDE_MODEL }
      );

      // 결과 확인 로깅
      logger.debug(
        `Claude API 응답 완료: ${
          result.correctedText ? "교정 결과 포함" : "교정 결과 없음"
        }`
      );

      // 결과 유효성 검사
      if (!result || !result.correctedText) {
        logger.error("유효하지 않은 Claude API 응답");
        throw new Error("교정 결과가 올바른 형식이 아닙니다");
      }

      return result;
    } catch (error) {
      // 오류 상세 로깅
      logger.error(`Claude API 호출 오류: ${error.message}`, {
        stack: error.stack,
        code: error.code || "UNKNOWN",
      });

      throw error;
    }
  }

  /**
   * 교정 결과를 저장합니다.
   * @param {string} articleId - 기사 ID
   * @param {number} promptType - 프롬프트 유형
   * @param {Object} result - API 응답 결과
   * @param {Array} styleGuides - 관련 스타일 가이드
   * @returns {Promise<Object>} - 저장된 교정 결과
   * @private
   */
  async saveCorrection(articleId, promptType, result, styleGuides = []) {
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
        original: c.original || c.originalText,
        suggestion: c.suggestion || c.correctedText,
        explanation: c.explanation,
        type: c.type || "other",
        priority: c.priority || 3,
        confidence: c.confidence || 0.8,
      })),
      llmInfo: {
        model: metadata.model || config.CLAUDE_MODEL,
        promptTokens: metadata.promptTokens || 0,
        completionTokens: metadata.completionTokens || 0,
        totalTokens: metadata.totalTokens || 0,
      },
      styleGuides: styleGuides.map((guide) => ({
        id: guide._id,
        section: guide.section,
        category: guide.category,
      })),
    });

    // 저장 및 반환
    const savedCorrection = await correction.save();
    logger.info(`교정 결과 저장 완료 (ID: ${savedCorrection._id})`);

    return savedCorrection;
  }

  /**
   * 오류 발생 시 대체 교정 결과를 생성합니다.
   * @param {string} articleId - 기사 ID
   * @param {number} promptType - 프롬프트 유형
   * @param {Array} styleGuides - 관련 스타일 가이드
   * @returns {Promise<Object>} - 대체 교정 결과
   * @private
   */
  async createFallbackCorrection(articleId, promptType, styleGuides = []) {
    try {
      logger.info("대체 교정 결과 생성 시도");

      // 기본 교정 객체 생성
      const fallbackCorrection = new Correction({
        articleId: articleId,
        promptType,
        correctedText: "오류로 인해 교정이 불가합니다. 다시 시도해 주세요.",
        changes: [],
        llmInfo: {
          model: "fallback",
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
        },
        styleGuides: styleGuides.map((guide) => ({
          id: guide._id,
          section: guide.section,
          category: guide.category,
        })),
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
      userId: feedbackData.userId || "anonymous",
      selectedPromptType: correction.promptType,
      rating: feedbackData.rating !== undefined ? feedbackData.rating : null,
      comment: feedbackData.comment || "",
      // 선호도 필드 추가
      preferences: feedbackData.preferences || {},
    });

    // 저장 및 반환
    const savedChoice = await userChoice.save();
    logger.info(`새 사용자 선택 저장 완료 (ID: ${savedChoice._id})`);

    return savedChoice;
  }

  /**
   * 맞춤형 교정을 생성합니다.
   * @param {string} articleId - 기사 ID
   * @param {Object} preferences - 사용자 선호도 설정
   * @returns {Promise<Object>} - 교정 결과
   */
  async generateCustomCorrection(articleId, preferences = {}) {
    try {
      // 기사 조회
      const article = await this.findArticleById(articleId);

      // 관련 스타일 가이드 검색
      const styleGuides = await findRelevantStyleguides(article.originalText);

      // 맞춤형 교정 생성 (프롬프트 유형 3)
      const correction = await this.generateCorrection(
        article._id,
        article.originalText,
        3,
        styleGuides
      );

      // 결과 포맷팅하여 반환
      return {
        id: correction._id,
        articleId: article._id,
        text: correction.correctedText,
        type: "custom",
        changes: correction.changes,
        preferences: preferences,
      };
    } catch (error) {
      logger.error(`맞춤형 교정 생성 오류: ${error.message}`);
      throw new Error(`맞춤형 교정 생성 중 오류 발생: ${error.message}`);
    }
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
   * 사용자 선호도를 분석하여 맞춤형 교정을 위한 설정을 생성합니다.
   * @param {string} userId - 사용자 ID
   * @returns {Promise<Object>} - 사용자 선호도 설정
   */
  async analyzeUserPreferences(userId) {
    try {
      // 사용자의 이전 선택 데이터 조회
      const userChoices = await UserChoice.find({
        userId: userId,
        rating: { $gte: 4 }, // 높은 평가(4점 이상)를 받은 선택만 고려
      }).populate("articleId");

      if (!userChoices || userChoices.length === 0) {
        logger.info(
          `사용자 ${userId}의 선호도 데이터가 충분하지 않습니다. 기본 선호도 설정을 반환합니다.`
        );
        return this.getDefaultPreferences();
      }

      // 선호도 분석을 위한 데이터 수집
      const promptTypeDistribution = {};
      let totalPreferredPromptType = 0;
      let totalComments = [];

      // 기본 선호도 설정
      const preferences = {
        preferredStyle: "neutral",
        formality: "neutral",
        conciseness: "neutral",
        focusAreas: [],
      };

      // 프롬프트 유형 분포 분석
      userChoices.forEach((choice) => {
        const promptType = choice.selectedPromptType;
        promptTypeDistribution[promptType] =
          (promptTypeDistribution[promptType] || 0) + 1;
        totalPreferredPromptType += promptType;

        if (choice.comment) {
          totalComments.push(choice.comment.toLowerCase());
        }
      });

      // 선호 교정 스타일 결정
      const avgPromptType = totalPreferredPromptType / userChoices.length;
      if (avgPromptType < 1.7) {
        preferences.preferredStyle = "minimal";
      } else if (avgPromptType > 2.3) {
        preferences.preferredStyle = "custom";
      } else if (avgPromptType > 1.7) {
        preferences.preferredStyle = "enhanced";
      }

      // 코멘트 기반 추가 분석
      const commentText = totalComments.join(" ");
      if (commentText.includes("격식") || commentText.includes("공식")) {
        preferences.formality = "formal";
      } else if (
        commentText.includes("친근") ||
        commentText.includes("자연스럽")
      ) {
        preferences.formality = "informal";
      }

      if (commentText.includes("간결") || commentText.includes("짧게")) {
        preferences.conciseness = "concise";
      } else if (commentText.includes("상세") || commentText.includes("자세")) {
        preferences.conciseness = "detailed";
      }

      // 초점 영역 분석
      const focusKeywords = {
        spelling: ["맞춤법", "띄어쓰기", "철자"],
        grammar: ["문법", "어법", "호응"],
        style: ["문체", "표현", "스타일"],
        flow: ["흐름", "논리", "연결"],
      };

      for (const [area, keywords] of Object.entries(focusKeywords)) {
        if (keywords.some((keyword) => commentText.includes(keyword))) {
          preferences.focusAreas.push(area);
        }
      }

      logger.info(`사용자 ${userId}의 선호도 분석 완료:`, preferences);
      return preferences;
    } catch (error) {
      logger.error(`사용자 선호도 분석 오류: ${error.message}`);
      return this.getDefaultPreferences();
    }
  }

  /**
   * 기본 선호도 설정을 반환합니다.
   * @returns {Object} - 기본 선호도 설정
   * @private
   */
  getDefaultPreferences() {
    return {
      preferredStyle: "neutral",
      formality: "neutral",
      conciseness: "neutral",
      focusAreas: ["spelling", "grammar"],
    };
  }
}

module.exports = new ProofreadingService();
