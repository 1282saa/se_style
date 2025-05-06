// src/services/proofreadingService.js
const mongoose = require("mongoose");
const Article = require("../models/article.model");
const Correction = require("../models/correction.model");
const UserChoice = require("../models/userChoice.model");
const styleGuideService = require("./styleGuideService");
const anthropicService = require("./llm/anthropicService");
const logger = require("../utils/logger");
const { extractChanges, calculateStats } = require("../utils/textAnalysis");
const cache = require("../utils/cache");
const { findRelevantStyleguides } = require("./rag/vectorSearch");
const { selectPrompt } = require("./llm/promptSelector");
const promptBuilder = require("./llm/promptBuilder");
const promptService = require("./llm/promptService");
const knowledgeService = require("./knowledgeService");
const ragService = require("./rag/ragService");
const config = require("../config");

/**
 * 교정 서비스
 * - 사용자 기사 교정 및 결과 관리
 * - 다양한 교정 스타일 제공 (최소, 적극적, 맞춤형)
 */
class ProofreadingService {
  constructor() {
    this.useRag = config.USE_RAG !== false;

    logger.info(`교정 서비스 초기화: RAG ${this.useRag ? "사용" : "미사용"}`);
  }

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

      // 2. 관련 스타일가이드 검색 (RAG 서비스 사용)
      const styleGuides = await this._findRelevantStyleGuides(text, {
        useHierarchical: true,
        limit: 10,
      });
      logger.info(
        `관련 스타일가이드 검색 완료 (RAG 사용 여부: ${this.useRag})`
      );

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

      // 관련 스타일 가이드 검색 (RAG 사용)
      const styleGuides = await this._findRelevantStyleGuides(
        article.originalText,
        {
          useHierarchical: options.useHierarchical ?? true,
          docType: options.docType ?? null,
          limit: options.guideLimit ?? 10,
        }
      );

      // 두 가지 교정 결과 생성 (병렬 처리)
      const [correction1, correction2] = await Promise.all([
        this.generateCorrection(
          article._id,
          article.originalText,
          1,
          styleGuides
        ),
        this.generateCorrection(
          article._id,
          article.originalText,
          2,
          styleGuides
        ),
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
   * 관련 스타일 가이드를 검색합니다. (RAG 및 기존 검색 지원)
   * @param {string} text - 검색할 텍스트
   * @param {Object} options - 검색 옵션
   * @returns {Promise<Array|Object>} - 검색된 스타일 가이드
   * @private
   */
  async _findRelevantStyleGuides(text, options = {}) {
    try {
      if (this.useRag) {
        const guides = await ragService.findRelevantGuides(text, options);

        if (!Array.isArray(guides)) {
          if (guides.documents) {
            return guides.documents;
          } else if (guides.categories) {
            return Object.values(guides.categories)
              .flat()
              .slice(0, options.limit || 10);
          }
        }

        return guides;
      } else {
        return await findRelevantStyleguides(text, {
          limit: options.limit || 10,
          minScore: options.minScore || 0.6,
        });
      }
    } catch (error) {
      logger.error(`스타일 가이드 검색 오류: ${error.message}`);
      return [];
    }
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
      const promptTypeNum = this._validatePromptType(promptType);

      // 1. 기존 교정 결과 확인
      const existingCorrection = await this._findExistingCorrection(
        articleId,
        promptTypeNum,
        styleGuides
      );
      if (existingCorrection) return existingCorrection;

      // 2. 프롬프트 레벨 결정
      const level = this._determinePromptLevel(promptTypeNum);

      // 3. 프롬프트 템플릿 선택
      const promptTemplate = await this._selectPromptTemplate(level);

      // 4. 관련 날리지 규칙 검색
      const knowledgeRules = await this._findRelevantKnowledge(text);

      // 5. 향상된 프롬프트 생성 (RAG 사용 여부에 따라 다른 방법 사용)
      const fullPrompt = await this._buildCorrectionPrompt(
        text,
        promptTemplate,
        {
          styleGuides,
          knowledgeRules,
        }
      );

      // 6. 캐시 키 생성
      const cacheKey = this._generateCacheKey(
        articleId,
        promptTypeNum,
        styleGuides
      );

      // 7. Claude API 호출
      const result = await this._callClaudeAPI(fullPrompt, text, cacheKey);

      // 8. 교정 결과 저장
      return await this._saveCorrection(
        articleId,
        promptTypeNum,
        result,
        styleGuides
      );
    } catch (error) {
      logger.error(
        `교정 생성 오류 (ID: ${articleId}, 유형: ${promptType}): ${error.message}`,
        { stack: error.stack }
      );
      // 오류 발생 시 대체 교정 생성
      return this._createFallbackCorrection(articleId, promptType, styleGuides);
    }
  }

  /** @private 프롬프트 유형 검증 */
  _validatePromptType(promptType) {
    const promptTypeNum = parseInt(promptType, 10);
    if (isNaN(promptTypeNum) || promptTypeNum < 1 || promptTypeNum > 3) {
      logger.warn(`유효하지 않은 promptType: ${promptType}, 기본값 1 사용`);
      return 1; // 기본값으로 최소 교정 (1) 사용
    }
    return promptTypeNum;
  }

  /** @private 프롬프트 레벨 결정 */
  _determinePromptLevel(promptTypeNum) {
    const levelMap = { 1: "minimal", 2: "enhanced", 3: "custom" };
    return levelMap[promptTypeNum] || "minimal";
  }

  /** @private 프롬프트 템플릿 선택 */
  async _selectPromptTemplate(level) {
    try {
      return await selectPrompt({ level, type: "correction" });
    } catch (promptError) {
      logger.warn(
        `프롬프트 템플릿 선택 오류: ${promptError.message}, 기본 템플릿 사용`
      );
      // 기본 템플릿 생성 (오류 발생 시) - 구조를 selectPrompt의 반환값과 일치시킴
      return {
        prompt_id: `proofread-${level}`,
        type: "correction",
        level: level,
        template: {
          prefix: `당신은 전문 한국어 교정 편집자입니다. 다음 텍스트를 ${
            level === "minimal" ? "최소한으로" : "적극적으로"
          } 교정해주세요:\n\n{{ORIGINAL_TEXT}}\n\n{{KNOWLEDGE_RULES}}\n\n{{STYLE_GUIDES}}\n\n교정 결과:`,
          suffix:
            '\n\n### 출력 형식:\n```json\n{\n  "correctedText": "교정된 텍스트",\n  "corrections": [\n    {\n      "type": "교정 유형",\n      "original": "원본 텍스트",\n      "suggestion": "교정된 텍스트",\n      "explanation": "이유"\n    }\n  ]\n}\n```',
        },
        tags: ["grammar", level],
      };
    }
  }

  /** @private 관련 날리지 규칙 검색 */
  async _findRelevantKnowledge(text) {
    try {
      const maxRules = text.length > 1000 ? 10 : 5;
      const knowledgeRules = await knowledgeService.findRelevantRules(text, {
        limit: maxRules,
        minScore: 0.65,
      });
      logger.info(`텍스트 관련 날리지 규칙 ${knowledgeRules.length}개 검색됨`);
      return knowledgeRules;
    } catch (knowledgeError) {
      logger.warn(`날리지 규칙 검색 오류: ${knowledgeError.message}`);
      return []; // 오류 시 빈 배열 반환
    }
  }

  /** @private 최종 교정 프롬프트 생성 */
  async _buildCorrectionPrompt(text, promptTemplate, options = {}) {
    const { styleGuides = [], knowledgeRules = [] } = options;
    try {
      // promptTemplate이 올바른 구조를 가지고 있는지 확인
      if (!promptTemplate || !promptTemplate.template) {
        throw new Error("유효하지 않은 프롬프트 템플릿 구조");
      }

      if (this.useRag) {
        // RAG 서비스 사용하여 프롬프트 향상
        // 1. 우선 기본 프롬프트 생성
        const basicPrompt = await promptBuilder.buildPrompt(
          promptTemplate.template,
          {
            ORIGINAL_TEXT: text,
            KNOWLEDGE_RULES:
              knowledgeService.formatRulesForPrompt(knowledgeRules),
            STYLE_GUIDES: "{{STYLE_GUIDES_PLACEHOLDER}}", // 나중에 RAG로 대체될 자리 표시자
          }
        );

        // 2. RAG 서비스로 스타일 가이드 통합 (기존 자리 표시자 대체)
        const ragPrompt = await ragService.enhancePromptWithRAG(
          basicPrompt.replace("{{STYLE_GUIDES_PLACEHOLDER}}", ""),
          text,
          {
            insertPoint: "beforeInstructions",
            maxTokens: 2000,
            styleGuides:
              Array.isArray(styleGuides) && styleGuides.length > 0
                ? styleGuides
                : undefined,
          }
        );

        return ragPrompt;
      } else {
        // 기존 방식: promptBuilder 직접 사용
        return await promptBuilder.buildPrompt(promptTemplate.template, {
          ORIGINAL_TEXT: text,
          KNOWLEDGE_RULES:
            knowledgeService.formatRulesForPrompt(knowledgeRules),
          STYLE_GUIDES:
            styleGuides.length > 0
              ? promptBuilder.formatStyleGuideList(styleGuides)
              : "참조할 스타일 가이드가 없습니다.",
        });
      }
    } catch (error) {
      logger.error(`프롬프트 생성 오류: ${error.message}`);
      // 오류 시 필수 요소만 포함한 기본 프롬프트 반환
      return `당신은 전문 한국어 교정 편집자입니다. 다음 텍스트를 교정해주세요:\n\n${text}\n\n교정 결과는 JSON 형식으로 반환해주세요.`;
    }
  }

  /** @private 기존 교정 결과 찾기 */
  async _findExistingCorrection(articleId, promptType, styleGuides = []) {
    const query = { articleId, promptType };
    // TODO: 스타일 가이드 버전이나 해시를 고려하여 캐시 무효화 로직 추가 필요
    // if (styleGuides.length > 0) {
    //   query.styleGuidesHash = calculateHash(styleGuides);
    // }
    const existingCorrection = await Correction.findOne(query);
    if (existingCorrection) {
      logger.info(`기존 교정 결과 반환 (ID: ${existingCorrection._id})`);
      return existingCorrection;
    }
    return null;
  }

  /** @private 캐시 키 생성 */
  _generateCacheKey(articleId, promptType, styleGuides = []) {
    // TODO: 스타일 가이드 변경을 반영하는 더 견고한 캐시 키 생성 방식 필요
    const styleGuidesStr = styleGuides
      .map((guide) => guide._id?.toString() || guide.ruleId || "")
      .filter((id) => id)
      .join(",");
    return `correction:${articleId}:${promptType}:${styleGuidesStr}`;
  }

  /** @private Claude API 호출 */
  async _callClaudeAPI(prompt, originalText, cacheKey) {
    try {
      logger.debug(`Claude API 호출 준비: 프롬프트 길이 ${prompt.length}자`);
      const result = await anthropicService.proofread(
        { prompt, textToAnalyze: originalText },
        { cacheKey, model: config.CLAUDE_MODEL }
      );
      logger.debug(
        `Claude API 응답 완료: ${
          result.correctedText ? "교정 결과 포함" : "교정 결과 없음"
        }`
      );
      if (!result || !result.correctedText) {
        logger.error("유효하지 않은 Claude API 응답");
        throw new Error("Claude API 응답 형식이 올바르지 않습니다.");
      }
      return result;
    } catch (error) {
      logger.error(`Claude API 호출 오류: ${error.message}`, {
        stack: error.stack,
        code: error.code || "UNKNOWN",
      });
      throw error; // 오류를 다시 던져서 generateCorrection에서 처리하도록 함
    }
  }

  /** @private 교정 결과 저장 */
  async _saveCorrection(articleId, promptType, result, styleGuides = []) {
    try {
      const correctionData = {
        articleId,
        promptType,
        correctedText: result.correctedText || "",
        changes: (result.corrections || []).map((c) => ({
          original: c.original || c.originalText,
          suggestion: c.suggestion || c.correctedText,
          explanation: c.explanation,
          type: c.type || "other",
          priority: c.priority || 3,
          confidence: c.confidence || 0.8,
        })),
        llmInfo: {
          model: result.metadata?.model || config.CLAUDE_MODEL,
          promptTokens: result.metadata?.promptTokens || 0,
          completionTokens: result.metadata?.completionTokens || 0,
          totalTokens: result.metadata?.totalTokens || 0,
        },
        // TODO: 참조된 스타일 가이드 ID 저장 방식 개선 필요 (해시 또는 버전)
        // styleGuides: styleGuides.map((guide) => guide._id)
      };
      const correction = new Correction(correctionData);
      const savedCorrection = await correction.save();
      logger.info(`교정 결과 저장 완료 (ID: ${savedCorrection._id})`);
      return savedCorrection;
    } catch (error) {
      logger.error(`교정 결과 저장 오류: ${error.message}`);
      // 저장 실패 시 오류를 던져서 상위에서 처리
      throw new Error(`교정 결과를 저장하는 중 오류 발생: ${error.message}`);
    }
  }

  /** @private 대체 교정 결과 생성 */
  async _createFallbackCorrection(articleId, promptType, styleGuides = []) {
    try {
      logger.warn(
        `대체 교정 결과 생성 (ID: ${articleId}, 유형: ${promptType})`
      );
      const fallbackData = {
        articleId: articleId,
        promptType: this._validatePromptType(promptType), // 여기서도 검증
        correctedText: "오류로 인해 교정이 불가합니다. 다시 시도해 주세요.",
        changes: [],
        llmInfo: { model: "fallback", totalTokens: 0 },
        // styleGuides: styleGuides.map(g => g._id) // 필요시 저장
      };
      const fallbackCorrection = new Correction(fallbackData);
      // 대체 결과는 저장하지 않고 바로 반환하거나, 저장 후 반환할 수 있음
      // 여기서는 저장하지 않고 객체만 반환
      // await fallbackCorrection.save();
      // logger.info(`대체 교정 결과 저장됨 (ID: ${fallbackCorrection._id})`);
      return fallbackCorrection; // 저장되지 않은 객체 반환
    } catch (fallbackError) {
      logger.error(`대체 교정 생성 실패: ${fallbackError.message}`);
      // 이 경우, 사용자에게 반환할 기본 객체 생성
      return {
        articleId,
        promptType,
        correctedText: "시스템 오류로 교정 결과를 생성할 수 없습니다.",
        changes: [],
        llmInfo: { model: "error", totalTokens: 0 },
      };
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
      this._validateCorrectionArticleMatch(article, correction);

      // 이전 선택 여부 확인
      const existingChoice = await UserChoice.findOne({ articleId });

      // 이전 선택이 있으면 업데이트, 없으면 새로 생성
      if (existingChoice) {
        return await this._updateUserChoice(
          existingChoice,
          correction,
          feedbackData
        );
      } else {
        return await this._createUserChoice(
          articleId,
          correction,
          feedbackData
        );
      }
    } catch (error) {
      logger.error(`사용자 선택 저장 오류: ${error.message}`);
      throw new Error(`사용자 선택 저장 중 오류 발생: ${error.message}`);
    }
  }

  async findCorrectionById(correctionId) {
    const correction = await Correction.findById(correctionId);
    if (!correction) {
      throw new Error(`교정 결과를 찾을 수 없습니다 (ID: ${correctionId})`);
    }
    return correction;
  }

  /** @private 교정 결과와 기사의 연결 확인 */
  _validateCorrectionArticleMatch(article, correction) {
    if (!correction.articleId.equals(article._id)) {
      throw new Error("교정 결과가 해당 기사와 연결되어 있지 않습니다");
    }
  }

  /** @private 기존 사용자 선택 업데이트 */
  async _updateUserChoice(existingChoice, correction, feedbackData) {
    existingChoice.selectedPromptType = correction.promptType;
    if (feedbackData.rating !== undefined) {
      existingChoice.rating = feedbackData.rating;
    }
    if (feedbackData.comment) {
      existingChoice.comment = feedbackData.comment;
    }
    // TODO: 피드백 데이터를 기반으로 preferences 필드 업데이트 로직 추가
    const updatedChoice = await existingChoice.save();
    logger.info(`사용자 선택 업데이트 완료 (ID: ${updatedChoice._id})`);
    return updatedChoice;
  }

  /** @private 새 사용자 선택 생성 */
  async _createUserChoice(articleId, correction, feedbackData) {
    const userChoice = new UserChoice({
      articleId,
      userId: feedbackData.userId || "anonymous",
      selectedPromptType: correction.promptType,
      rating: feedbackData.rating !== undefined ? feedbackData.rating : null,
      comment: feedbackData.comment || "",
      preferences: feedbackData.preferences || {},
    });
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

      // 관련 스타일 가이드 검색 (RAG 사용)
      const styleGuides = await this._findRelevantStyleGuides(
        article.originalText,
        {
          useHierarchical: preferences.useHierarchical !== false,
          docType: preferences.docType || ["guideline", "rule"],
          limit: 15,
        }
      );

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
        rating: { $gte: 4 },
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
      preferredStyle: "balanced",
      formality: "neutral",
      conciseness: "neutral",
      focusAreas: ["spelling", "grammar"],
    };
  }
}

module.exports = new ProofreadingService();
