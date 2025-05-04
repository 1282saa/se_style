// src/services/llm/llm.service.js
const axios = require("axios");
const config = require("../../config");
const logger = require("../../utils/logger");
const anthropicService = require("./anthropicService");

// 캐싱을 위한 메모리 저장소
const cache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1시간 (밀리초)

/**
 * LLM 서비스 - Claude API 중심으로 구현
 */
class LLMService {
  /**
   * Claude를 사용하여 텍스트 생성
   * @param {string} prompt - 프롬프트
   * @param {Object} options - 옵션 (cacheKey, model 등)
   * @returns {Promise<Object>} - 생성 결과
   */
  async generateWithClaude(prompt, options = {}) {
    try {
      logger.info("[LLMService] Claude로 텍스트 생성 시작");

      // 캐싱 로직 구현 가능 (options.cacheKey 사용)

      const result = await anthropicService.proofread(prompt);

      // 결과 후처리 및 반환
      return {
        text: result.correctedText || result.text || "",
        metadata: {
          model: options.model || "claude-3-opus",
          promptTokens: 0, // 실제 토큰 계산 로직이 필요
          completionTokens: 0,
          totalTokens: 0,
        },
      };
    } catch (error) {
      logger.error(`[LLMService] Claude 텍스트 생성 오류: ${error.message}`);

      // 오류 발생 시 기본 응답
      return {
        text: prompt.length > 100 ? prompt.substring(0, 100) + "..." : prompt,
        error: error.message,
        metadata: {
          model: "fallback",
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
        },
      };
    }
  }

  /**
   * 텍스트를 분석하여 임베딩 벡터를 생성합니다.
   * @param {string} text - 임베딩할 텍스트
   * @returns {Promise<number[]>} - 임베딩 벡터
   */
  async createEmbedding(text) {
    try {
      // Claude API 요청 구성
      const response = await axios.post(
        "https://api.anthropic.com/v1/embeddings",
        {
          model: config.EMBEDDING_MODEL,
          input: text,
        },
        {
          headers: {
            "Content-Type": "application/json",
            "x-api-key": config.ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
          },
        }
      );

      return response.data.embedding;
    } catch (error) {
      logger.error(`임베딩 생성 오류: ${error.message}`);
      if (error.response) {
        logger.error(`Claude API 응답: ${JSON.stringify(error.response.data)}`);
      }
      throw new Error(`임베딩 생성 중 오류 발생: ${error.message}`);
    }
  }

  /**
   * 캐시를 정리합니다.
   * @param {string} key - 특정 캐시 키 (선택 사항)
   * @param {boolean} expiredOnly - 만료된 항목만 제거 (선택 사항)
   * @returns {number} - 제거된 항목 수
   */
  clearCache(key = null, expiredOnly = false) {
    let count = 0;
    const now = Date.now();

    if (key) {
      // 특정 키만 제거
      if (cache.has(key)) {
        cache.delete(key);
        count = 1;
      }
    } else if (expiredOnly) {
      // 만료된 항목만 제거
      for (const [k, { timestamp }] of cache.entries()) {
        if (now - timestamp >= CACHE_TTL) {
          cache.delete(k);
          count++;
        }
      }
    } else {
      // 모든 캐시 제거
      count = cache.size;
      cache.clear();
    }

    logger.info(`캐시 정리 완료: ${count}개 항목 제거됨`);
    return count;
  }
}

module.exports = new LLMService();
