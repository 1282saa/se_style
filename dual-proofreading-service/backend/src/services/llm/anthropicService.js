// src/services/llm/anthropicService.js
//--------------------------------------------------
/* Claude 3 교열 + 임베딩 래퍼 (120 s 타임아웃·Redis TTL 캐시) */

const Anthropic = require("@anthropic-ai/sdk");
const { AppError } = require("../../utils/error");
const logger = require("../../utils/logger");
const config = require("../../config");
const cache = require("../../utils/cache");
const redis = require("../../utils/redisClient");
const { estimateTokens } = require("../../utils/tokens");
const axios = require("axios");
const embeddingProvider = require("../rag/embeddingProvider");

const MASK_PII = (s = "") =>
  s
    .replace(/[\d\w._%+-]+@[\d\w.-]+\.[A-Za-z]{2,}/g, "[email]")
    .replace(/\b01[0-9]-?\d{3,4}-?\d{4}\b/g, "[phone]");

class AnthropicService {
  constructor() {
    logger.info(
      "ANTHROPIC_API_KEY 확인:",
      process.env.ANTHROPIC_API_KEY
        ? "설정됨 (길이: " + process.env.ANTHROPIC_API_KEY.length + ")"
        : "미설정"
    );

    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY 누락—서비스 중단");
    }

    try {
      this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      this.model = config.CLAUDE_MODEL || "claude-3-opus-20240229";
      this.maxTokens = Number(config.ANTHROPIC_MAX_TOKENS) || 4000;
      this.embedModel = config.EMBEDDING_MODEL || "claude-3-sonnet-20240229";
      this.apiKey = process.env.ANTHROPIC_API_KEY;
      this.baseUrl = "https://api.anthropic.com/v1/messages";

      logger.info(
        `AnthropicService 초기화 (model=${this.model}, maxTokens=${this.maxTokens})`
      );
    } catch (err) {
      logger.error(`Anthropic 클라이언트 초기화 오류: ${err.message}`);
      throw err;
    }
  }

  /* ---------- 1. 교열 ---------- */
  async proofread(
    { prompt, textToAnalyze },
    { cacheKey, model = this.model } = {}
  ) {
    logger.debug(`prompt(200↓): "${MASK_PII(prompt).slice(0, 200)}…"`);
    if (cacheKey) {
      const mHit = cache.get(cacheKey);
      if (mHit) return mHit;
      const rHit = await redis.get(cacheKey);
      if (rHit) return JSON.parse(rHit);
    }

    // 타임아웃 설정 (별도의 AbortController는 제거)
    const timeoutMs = 120000; // 120초 (2분)로 증가

    let res;
    try {
      // 토큰 예측 부분에 안전 장치 추가
      let maxTokenCount = this.maxTokens;
      try {
        const estimatedPromptTokens = estimateTokens(prompt);
        maxTokenCount = Math.min(this.maxTokens, 8000 - estimatedPromptTokens);
      } catch (tokenErr) {
        logger.warn(`토큰 예측 오류, 기본값 사용: ${tokenErr.message}`);
        maxTokenCount = 4000; // 기본값 사용
      }

      // API 요청 옵션 설정
      const requestOptions = {
        model,
        max_tokens: maxTokenCount,
        temperature: 0.3,
        system:
          "당신은 한국어 교정 전문가입니다. 텍스트의 맞춤법, 문법, 표현을 정확하게 교정하고 개선점을 제안합니다.",
        messages: [{ role: "user", content: prompt }],
        // signal 매개변수는 제거
      };

      // API 요청 (타임아웃 옵션 추가)
      const fetchPromise = this.client.messages.create(requestOptions);

      // 타임아웃 Promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error("교정 요청 시간이 초과되었습니다."));
        }, timeoutMs);
      });

      // Promise.race로 타임아웃 처리
      res = await Promise.race([fetchPromise, timeoutPromise]);
    } catch (err) {
      if (err.message === "교정 요청 시간이 초과되었습니다.") {
        throw new AppError("PROOFREAD_TIMEOUT", 504, err.message);
      } else {
        logger.error(`Claude API 오류: ${err.message}`, {
          stack: err.stack,
          response: err.response
            ? JSON.stringify(err.response)
            : "No response data",
        });
        throw new AppError("PROOFREAD_ERROR", 502, err.message);
      }
    }

    const result = this.#parse(res, textToAnalyze);

    if (cacheKey) {
      cache.set(cacheKey, result);
      redis.set(cacheKey, JSON.stringify(result), "EX", 3600);
    }

    logger.info(`proofread 완료 (tokens=${result.metadata.totalTokens})`);
    return result;
  }

  /* ---------- 2. 임베딩 ---------- */
  // createEmbedding 메소드 제거

  /* ---------- private ---------- */
  #parse(r, origin) {
    try {
      const t = r.content?.[0]?.text || "";
      const m = {
        model: r.model,
        promptTokens: r.usage?.input_tokens ?? 0,
        completionTokens: r.usage?.output_tokens ?? 0,
        totalTokens: r.usage?.total_tokens ?? 0,
      };

      // JSON 코드 블록 추출 시도
      let jsonContent = null;
      const jsonBlock = t.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonBlock && jsonBlock[1]) {
        try {
          jsonContent = JSON.parse(jsonBlock[1]);
          logger.debug(`JSON 코드 블록 파싱 성공`);
        } catch (e) {
          logger.warn(`JSON 파싱 실패 (코드 블록): ${e.message}`);
        }
      }

      // 일반 JSON 객체 추출 시도
      if (!jsonContent) {
        const jsonObj = t.match(/{[\s\S]*?}/);
        if (jsonObj && jsonObj[0]) {
          try {
            jsonContent = JSON.parse(jsonObj[0]);
            logger.debug(`일반 JSON 객체 파싱 성공`);
          } catch (e) {
            logger.warn(`JSON 파싱 실패 (일반 객체): ${e.message}`);
          }
        }
      }

      // JSON이 성공적으로 파싱된 경우
      if (jsonContent) {
        return {
          correctedText:
            jsonContent.correctedText || jsonContent.corrected_text || t,
          corrections: jsonContent.corrections || jsonContent.changes || [],
          metadata: m,
        };
      }

      // JSON 파싱 실패 시 텍스트 자체를 교정 결과로 사용
      logger.warn(
        "구조화된 JSON 응답을 찾을 수 없음, 텍스트 전체를 교정 결과로 사용"
      );
      return { correctedText: t, corrections: [], metadata: m };
    } catch (error) {
      logger.error(`응답 파싱 오류: ${error.message}`);
      // 기본 응답 반환
      return {
        correctedText: origin || "교정 결과를 처리하는 중 오류가 발생했습니다.",
        corrections: [],
        metadata: { model: r.model || "unknown" },
      };
    }
  }

  /**
   * Claude API를 사용하여 텍스트 생성
   * @param {string} systemPrompt - 시스템 프롬프트
   * @param {string} userPrompt - 사용자 프롬프트
   * @param {Object} options - 추가 옵션
   * @returns {Promise<Object>} - Claude API 응답
   */
  async generateText(systemPrompt, userPrompt, options = {}) {
    try {
      if (!this.apiKey) {
        throw new Error("ANTHROPIC_API_KEY가 설정되지 않았습니다.");
      }

      const maxTokens = options.maxTokens || 4000;
      const temperature = options.temperature || 0.7;

      logger.info(`Claude API 요청: ${userPrompt.substring(0, 50)}...`);

      const response = await axios.post(
        this.baseUrl,
        {
          model: this.model,
          system: systemPrompt,
          messages: [
            {
              role: "user",
              content: userPrompt,
            },
          ],
          max_tokens: maxTokens,
          temperature: temperature,
        },
        {
          headers: {
            "Content-Type": "application/json",
            "X-Api-Key": this.apiKey,
            "anthropic-version": "2023-06-01",
          },
        }
      );

      logger.info("Claude API 응답 수신 완료");
      return response.data;
    } catch (error) {
      logger.error(`Claude API 오류: ${error.message}`);
      if (error.response) {
        logger.error(`상태 코드: ${error.response.status}`);
        logger.error(`응답 데이터: ${JSON.stringify(error.response.data)}`);
      }
      throw error;
    }
  }

  /**
   * JSON 응답을 안전하게 파싱합니다.
   * @param {string} text - 파싱할 텍스트
   * @returns {Object|null} - 파싱된 객체 또는 null
   */
  safeParseJSON(text) {
    if (!text) return null;

    try {
      // 1. 직접 파싱 시도
      return JSON.parse(text);
    } catch (directError) {
      logger.debug(`직접 JSON 파싱 실패: ${directError.message}`);

      try {
        // 2. 제어 문자 제거 후 파싱 시도
        const cleanedText = text.replace(/[\u0000-\u001F\u007F-\u009F]/g, "");
        return JSON.parse(cleanedText);
      } catch (cleanError) {
        logger.debug(`정제 후 JSON 파싱 실패: ${cleanError.message}`);

        try {
          // 3. JSON 코드 블록에서 추출 시도
          const jsonBlockRegex = /```(?:json)?\s*({[\s\S]*?})\s*```/;
          const match = text.match(jsonBlockRegex);

          if (match && match[1]) {
            const jsonContent = match[1]
              .trim()
              .replace(/[\u0000-\u001F\u007F-\u009F]/g, "");
            return JSON.parse(jsonContent);
          }
        } catch (blockError) {
          logger.debug(`JSON 블록 파싱 실패: ${blockError.message}`);
        }

        // 4. 모든 방법 실패
        logger.warn("모든 JSON 파싱 방법 실패");
        return null;
      }
    }
  }
}

/**
 * 소셜 미디어용 콘텐츠 생성
 * @param {string} originalText - 원본 텍스트
 * @param {string} platform - 소셜 미디어 플랫폼
 * @returns {Promise<string>} - 최적화된 텍스트
 */
async function generateSocialContent(originalText, platform = "instagram") {
  const anthropicService = module.exports; // 현재 모듈 인스턴스

  // 플랫폼별 프롬프트 커스터마이징
  let systemPrompt, userPrompt;

  // 시스템 프롬프트 기본 설정
  let maxLength;
  switch (platform.toLowerCase()) {
    case "instagram":
      systemPrompt = `당신은 인스타그램 게시물을 작성하는 전문가입니다. 인스타그램에 적합한 간결하고 매력적인 텍스트를 생성하세요. 해시태그를 적절히 추가하고, 이모지를 사용해 텍스트에 생동감을 부여하세요. 최대 2,200자 이내로 작성하세요.`;
      maxLength = 2200;
      break;
    case "thread":
      systemPrompt = `당신은 스레드(Thread) 게시물 작성 전문가입니다. 간결하면서도 핵심적인 내용을 담은 500자 이내의 스레드 게시물을 작성하세요. 가독성이 좋고 흥미로운 내용이 되도록 하세요.`;
      maxLength = 500;
      break;
    case "twitter":
      systemPrompt = `당신은 트위터(X) 게시물 작성 전문가입니다. 280자 이내의 간결하면서도 임팩트 있는 트윗을 작성하세요. 해시태그는 1-2개 정도만 적절히 사용하고, 핵심 메시지가 명확히 전달되도록 하세요.`;
      maxLength = 280;
      break;
    case "facebook":
      systemPrompt = `당신은 페이스북 게시물 작성 전문가입니다. 친근하고 대화하듯 자연스러운 텍스트를 생성하세요. 적절한 길이(최대 1,000자)로 내용을 요약하고 흥미로운 관점을 제시하세요.`;
      maxLength = 1000;
      break;
    case "linkedin":
      systemPrompt = `당신은 링크드인 게시물 작성 전문가입니다. 전문적이고 정보가 풍부한 비즈니스 관점의 게시물을 작성하세요. 3,000자 이내로 주요 포인트를 명확히 전달하고, 독자의 참여를 유도하는 질문으로 마무리하세요.`;
      maxLength = 3000;
      break;
    default:
      systemPrompt = `당신은 소셜 미디어 콘텐츠 작성 전문가입니다. 제공된 텍스트를 소셜 미디어에 적합한 형식으로 변환하세요. 간결하면서도 핵심 메시지를 유지하고, 독자의 관심을 끌 수 있도록 작성하세요.`;
      maxLength = 1000;
  }

  // 사용자 프롬프트 구성
  userPrompt = `다음 텍스트를 ${platform} 플랫폼에 최적화된 게시물로 변환해주세요:

${originalText}

요구사항:
1. ${maxLength}자 이내로 작성
2. 핵심 메시지를 유지하면서 매력적인 표현 사용
3. 플랫폼에 맞는 스타일 적용(${platform}의 특성에 맞게)
4. 가독성 향상을 위해 단락 나누기
5. JSON 형식 없이 텍스트만 반환`;

  try {
    // Claude API 호출
    const response = await anthropicService.generateText(
      systemPrompt,
      userPrompt,
      {
        temperature: 0.7,
        maxTokens: 2000,
      }
    );

    // 응답에서 텍스트 추출
    const generatedText = response.content[0].text;

    // 텍스트 정리 (불필요한 인용 부호, JSON 형식 제거 등)
    let cleanedText = generatedText
      .replace(/```[\s\S]*?```/g, "") // 코드 블록 제거
      .replace(/"{3}[\s\S]*?"{3}/g, "") // 삼중 따옴표 블록 제거
      .replace(/^["']|["']$/g, "") // 시작/끝 따옴표 제거
      .trim();

    // 텍스트가 '{'로 시작하고 '}'로 끝나면 JSON으로 간주하고 처리
    if (cleanedText.startsWith("{") && cleanedText.endsWith("}")) {
      try {
        const jsonContent = JSON.parse(cleanedText);
        // JSON 형식인 경우 내용만 추출
        if (jsonContent.text || jsonContent.content) {
          cleanedText = jsonContent.text || jsonContent.content;
        }
      } catch (err) {
        // JSON 파싱 실패하면 원본 텍스트 사용
        logger.warn(`JSON 파싱 실패: ${err.message}`);
      }
    }

    // 길이 제한
    if (cleanedText.length > maxLength) {
      cleanedText = cleanedText.substring(0, maxLength);
    }

    return cleanedText;
  } catch (error) {
    logger.error(`소셜 미디어 콘텐츠 생성 실패: ${error.message}`);
    throw new Error(`소셜 미디어 콘텐츠 생성 실패: ${error.message}`);
  }
}

// 모듈 내보내기에 함수 추가
const anthropicService = module.exports;
anthropicService.generateSocialContent = generateSocialContent;

module.exports = new AnthropicService();
