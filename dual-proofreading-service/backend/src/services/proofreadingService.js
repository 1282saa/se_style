// src/services/proofreadingService.js
const mongoose = require("mongoose");
const Article = require("../models/article.model");
const Correction = require("../models/correction.model");
const UserChoice = require("../models/userChoice.model");
const styleGuideService = require("./styleGuideService");
const llmService = require("./llm/llm.service");
const promptGenerator = require("./llm/promptGenerator");
const logger = require("../utils/logger");
const config = require("../config");

class ProofreadingService {
  /**
   * 새 기사를 생성합니다.
   * @param {Object} articleData - 기사 데이터
   * @returns {Promise<Object>} - 생성된 기사 객체
   */
  async createArticle(articleData) {
    try {
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
      const article = await Article.findById(articleId);
      if (!article) {
        throw new Error(`기사를 찾을 수 없습니다 (ID: ${articleId})`);
      }

      // 관련 스타일 가이드 검색
      const styleGuides = await styleGuideService.findRelatedStyleGuides(
        article.originalText,
        5
      );
      logger.debug(`관련 스타일 가이드 ${styleGuides.length}개 발견`);

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
   * 지정된 프롬프트 유형으로 교정 결과를 생성합니다.
   * @param {Object} article - 기사 객체
   * @param {Array} styleGuides - 관련 스타일 가이드
   * @param {number} promptType - 프롬프트 유형 (1: 최소, 2: 적극적)
   * @returns {Promise<Object>} - 교정 결과 객체
   */
  async generateCorrection(article, styleGuides, promptType) {
    try {
      // 교정 결과가 이미 존재하는지 확인
      const existingCorrection = await Correction.findOne({
        articleId: article._id,
        promptType,
      });

      if (existingCorrection) {
        logger.info(`기존 교정 결과 반환 (ID: ${existingCorrection._id})`);
        return existingCorrection;
      }

      // 프롬프트 생성
      const prompt = promptGenerator.generatePrompt(
        promptType,
        article.originalText,
        styleGuides
      );

      // 텍스트 생성을 위한 캐시 키 구성
      const cacheKey = `correction:${article._id}:${promptType}:${styleGuides.length}`;

      // LLM 호출
      const result = await llmService.generateWithClaude(prompt, {
        cacheKey,
        model: config.CLAUDE_MODEL,
      });

      // 교정 결과 저장
      const correction = new Correction({
        articleId: article._id,
        promptType,
        correctedText: result.text,
        llmInfo: {
          model: result.metadata.model,
          promptTokens: result.metadata.promptTokens,
          completionTokens: result.metadata.completionTokens,
          totalTokens: result.metadata.totalTokens,
        },
      });

      // 교정 결과에서 변경 사항 분석
      const changes = this.analyzeChanges(
        article.originalText,
        result.text,
        styleGuides
      );
      if (changes && changes.length > 0) {
        correction.changes = changes;
      }

      // 저장
      const savedCorrection = await correction.save();
      logger.info(`교정 결과 저장 완료 (ID: ${savedCorrection._id})`);

      return savedCorrection;
    } catch (error) {
      logger.error(
        `교정 생성 오류 (프롬프트 유형: ${promptType}): ${error.message}`
      );
      throw new Error(`교정 생성 중 오류 발생: ${error.message}`);
    }
  }

  /**
   * 원문과 교정본의 차이를 분석합니다.
   * @param {string} original - 원문 텍스트
   * @param {string} corrected - 교정 텍스트
   * @param {Array} styleGuides - 관련 스타일 가이드
   * @returns {Array} - 변경 사항 배열
   */
  analyzeChanges(original, corrected, styleGuides = []) {
    try {
      // 간단한 구현: 공백으로 구분된 단어 수준에서 비교
      const originalWords = original.split(/\s+/);
      const correctedWords = corrected.split(/\s+/);

      const changes = [];
      let i = 0,
        j = 0;

      while (i < originalWords.length && j < correctedWords.length) {
        if (originalWords[i] !== correctedWords[j]) {
          // 변경 사항 발견
          let originalChunk = originalWords[i];
          let correctedChunk = correctedWords[j];

          // 다음 몇 개 단어까지 덩어리로 검사
          let nextMatchOriginal = -1;
          let nextMatchCorrected = -1;
          const lookAhead = 5; // 최대 탐색 범위

          // 원문의 다음 단어가 교정본에 있는지 확인
          for (
            let k = i + 1;
            k < Math.min(i + lookAhead, originalWords.length);
            k++
          ) {
            const searchIndex = correctedWords.indexOf(originalWords[k], j);
            if (searchIndex !== -1) {
              nextMatchOriginal = k;
              nextMatchCorrected = searchIndex;
              break;
            }
          }

          // 교정본의 다음 단어가 원문에 있는지 확인
          if (nextMatchOriginal === -1) {
            for (
              let k = j + 1;
              k < Math.min(j + lookAhead, correctedWords.length);
              k++
            ) {
              const searchIndex = originalWords.indexOf(correctedWords[k], i);
              if (searchIndex !== -1) {
                nextMatchCorrected = k;
                nextMatchOriginal = searchIndex;
                break;
              }
            }
          }

          // 변경 덩어리 구성
          if (nextMatchOriginal !== -1 && nextMatchCorrected !== -1) {
            // 다음 일치 지점까지의 덩어리 추출
            originalChunk = originalWords.slice(i, nextMatchOriginal).join(" ");
            correctedChunk = correctedWords
              .slice(j, nextMatchCorrected)
              .join(" ");
            i = nextMatchOriginal;
            j = nextMatchCorrected;
          } else {
            // 일치 지점을 찾지 못한 경우 현재 단어만 처리
            i++;
            j++;
          }

          // 관련 스타일 가이드 규칙 찾기
          const relatedRule = this.findRelatedRule(originalChunk, styleGuides);

          // 변경 사항 추가
          changes.push({
            original: originalChunk,
            suggestion: correctedChunk,
            ruleId: relatedRule ? relatedRule._id : null,
            explanation: relatedRule ? relatedRule.content : "표현 개선",
            priority: relatedRule ? relatedRule.priority : 3,
            confidence: 0.8, // 간단한 구현에서는 고정 값 사용
          });
        } else {
          // 일치하는 경우 다음 단어로 이동
          i++;
          j++;
        }
      }

      return changes;
    } catch (error) {
      logger.error(`변경 사항 분석 오류: ${error.message}`);
      return [];
    }
  }

  /**
   * 원문 표현과 관련된 스타일 가이드 규칙을 찾습니다.
   * @param {string} text - 원문 표현
   * @param {Array} styleGuides - 스타일 가이드 배열
   * @returns {Object|null} - 관련 규칙 또는 null
   */
  findRelatedRule(text, styleGuides) {
    if (!styleGuides || styleGuides.length === 0) {
      return null;
    }

    // 간단한 구현: 텍스트 포함 여부로 관련 규칙 검색
    for (const guide of styleGuides) {
      if (guide.content && guide.content.includes(text)) {
        return guide;
      }
    }

    return null;
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
        Article.findById(articleId),
        Correction.findById(correctionId),
      ]);

      if (!article) {
        throw new Error(`기사를 찾을 수 없습니다 (ID: ${articleId})`);
      }

      if (!correction) {
        throw new Error(`교정 결과를 찾을 수 없습니다 (ID: ${correctionId})`);
      }

      if (!correction.articleId.equals(article._id)) {
        throw new Error("교정 결과가 해당 기사와 연결되어 있지 않습니다");
      }

      // 이전 선택 여부 확인
      const existingChoice = await UserChoice.findOne({ articleId });

      if (existingChoice) {
        // 기존 선택 업데이트
        existingChoice.selectedPromptType = correction.promptType;

        if (feedbackData.rating) {
          existingChoice.rating = feedbackData.rating;
        }

        if (feedbackData.comment) {
          existingChoice.comment = feedbackData.comment;
        }

        const updatedChoice = await existingChoice.save();
        logger.info(`사용자 선택 업데이트 완료 (ID: ${updatedChoice._id})`);

        return updatedChoice;
      } else {
        // 새 선택 생성
        const userChoice = new UserChoice({
          articleId,
          selectedPromptType: correction.promptType,
          rating: feedbackData.rating || null,
          comment: feedbackData.comment || "",
        });

        const savedChoice = await userChoice.save();
        logger.info(`새 사용자 선택 저장 완료 (ID: ${savedChoice._id})`);

        return savedChoice;
      }
    } catch (error) {
      logger.error(`사용자 선택 저장 오류: ${error.message}`);
      throw new Error(`사용자 선택 저장 중 오류 발생: ${error.message}`);
    }
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
      // 1. 새 기사 생성
      const article = await this.createArticle({
        userId,
        originalText: text,
        metadata,
      });

      // 2. 관련 스타일 가이드 검색
      const styleGuides = await styleGuideService.findRelatedStyleGuides(
        text,
        5
      );
      logger.debug(`관련 스타일 가이드 ${styleGuides.length}개 발견`);

      // 3. 두 가지 교정 결과 생성 (병렬 처리)
      const [correction1, correction2] = await Promise.all([
        this.generateCorrection(article, styleGuides, 1),
        this.generateCorrection(article, styleGuides, 2),
      ]);

      // 4. 결과 반환
      return {
        articleId: article._id,
        original: text,
        correction1: {
          id: correction1._id,
          text: correction1.correctedText,
          type: "minimal",
        },
        correction2: {
          id: correction2._id,
          text: correction2.correctedText,
          type: "enhanced",
        },
        styleGuides: styleGuides.map((guide) => ({
          id: guide._id,
          section: guide.section,
          category: guide.category,
        })),
      };
    } catch (error) {
      logger.error(`간편 교정 오류: ${error.message}`);
      throw new Error(`간편 교정 중 오류 발생: ${error.message}`);
    }
  }

  /**
   * 사용자의 선호도에 맞는 맞춤형 교정을 수행합니다.
   * @param {string} text - 교정할 텍스트
   * @param {string} userId - 사용자 ID
   * @param {Object} preferences - 사용자 선호도
   * @returns {Promise<Object>} - 교정 결과
   */
  async customProofread(text, userId, preferences = {}) {
    try {
      // 1. 새 기사 생성
      const article = await this.createArticle({
        userId,
        originalText: text,
      });

      // 2. 관련 스타일 가이드 검색
      const styleGuides = await styleGuideService.findRelatedStyleGuides(
        text,
        5
      );

      // 3. 맞춤형 프롬프트 생성
      const prompt = promptGenerator.generateCustomPrompt(
        text,
        styleGuides,
        preferences
      );

      // 4. LLM 호출
      const cacheKey = `custom:${article._id}:${JSON.stringify(preferences)}`;
      const result = await llmService.generateWithClaude(prompt, {
        cacheKey,
        model: config.CLAUDE_MODEL,
      });

      // 5. 교정 결과 저장
      const correction = new Correction({
        articleId: article._id,
        promptType: 3, // 맞춤형은 3번으로 구분
        correctedText: result.text,
        llmInfo: {
          model: result.metadata.model,
          promptTokens: result.metadata.promptTokens,
          completionTokens: result.metadata.completionTokens,
          totalTokens: result.metadata.totalTokens,
        },
      });

      const savedCorrection = await correction.save();

      // 6. 결과 반환
      return {
        articleId: article._id,
        original: text,
        correction: {
          id: savedCorrection._id,
          text: savedCorrection.correctedText,
          type: "custom",
        },
      };
    } catch (error) {
      logger.error(`맞춤형 교정 오류: ${error.message}`);
      throw new Error(`맞춤형 교정 중 오류 발생: ${error.message}`);
    }
  }
}

module.exports = new ProofreadingService();
