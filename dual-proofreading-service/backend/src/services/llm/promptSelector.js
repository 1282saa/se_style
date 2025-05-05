const mongoose = require("mongoose");
const logger = require("../../utils/logger");
const cache = require("../../utils/cache");
const fs = require("fs");
const path = require("path");

// 프롬프트 모델 (없는 경우 이 파일에서 정의)
const PromptModel =
  mongoose.models.Prompt ||
  mongoose.model(
    "Prompt",
    new mongoose.Schema({
      prompt_id: { type: String, required: true, unique: true, index: true },
      type: { type: String, required: true, index: true },
      level: { type: String, required: true, index: true },
      template: {
        prefix: { type: String, required: true },
        suffix: { type: String, required: true },
      },
      tags: [{ type: String }],
      isActive: { type: Boolean, default: true },
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now },
    })
  );

/**
 * 기사 상황에 맞는 프롬프트 템플릿을 선택합니다.
 * @param {Object} options - 선택 옵션
 * @param {string} options.level - 교정 수준 (minimal, enhanced, custom)
 * @param {Array<string>} options.tags - 태그 배열
 * @param {string} options.type - 프롬프트 유형 (correction, analysis, etc)
 * @param {string} options.prompt_id - 특정 프롬프트 ID
 * @returns {Promise<Object>} - 선택된 프롬프트 템플릿
 */
async function selectPrompt(options = {}) {
  try {
    const {
      level = "minimal",
      tags = [],
      type = "correction",
      prompt_id = null,
      useCache = true,
    } = options;

    // 캐시 키 생성
    const cacheKey = useCache
      ? `prompt:${prompt_id || `${type}:${level}:${tags.sort().join(",")}`}`
      : null;

    // 캐시 확인
    if (cacheKey) {
      const cachedPrompt = cache.get(cacheKey);
      if (cachedPrompt) {
        logger.debug(`프롬프트 캐시 적중: ${cacheKey}`);
        return cachedPrompt;
      }
    }

    // 쿼리 생성
    const query = { isActive: true };

    // 특정 ID로 검색하는 경우
    if (prompt_id) {
      query.prompt_id = prompt_id;
    } else {
      // 타입과 레벨로 검색
      query.type = type;
      query.level = level;

      // 태그가 있는 경우 태그 필터링
      if (tags && tags.length > 0) {
        query.tags = { $in: tags };
      }
    }

    // 데이터베이스에서 프롬프트 검색
    let prompt = await PromptModel.findOne(query);

    // 일치하는 프롬프트가 없는 경우 기본값 사용
    if (!prompt) {
      logger.warn(`일치하는 프롬프트를 찾을 수 없음: ${JSON.stringify(query)}`);

      // 타입과 레벨만으로 재검색
      if (tags && tags.length > 0) {
        delete query.tags;
        prompt = await PromptModel.findOne(query);
      }

      // 여전히 없으면 기본 프롬프트 사용
      if (!prompt) {
        prompt = await getDefaultPrompt(level);
      }
    }

    // 캐싱
    if (cacheKey && prompt) {
      cache.set(cacheKey, prompt, 3600); // 1시간 캐시
    }

    return prompt;
  } catch (error) {
    logger.error(`프롬프트 선택 오류: ${error.message}`);
    return getDefaultPrompt();
  }
}

/**
 * 기본 프롬프트를 반환합니다.
 * @param {string} level - 교정 수준
 * @returns {Promise<Object>} - 기본 프롬프트
 * @private
 */
async function getDefaultPrompt(level = "minimal") {
  // 데이터베이스에서 먼저 검색
  try {
    const defaultPrompt = await PromptModel.findOne({
      prompt_id: `proofread-${level}`,
      isActive: true,
    });

    if (defaultPrompt) {
      return defaultPrompt;
    }
  } catch (error) {
    logger.error(`기본 프롬프트 검색 오류: ${error.message}`);
  }

  // 하드코딩된 기본 프롬프트 (데이터베이스에 없는 경우)
  const defaultPrompts = {
    minimal: {
      prompt_id: "proofread-minimal",
      type: "correction",
      level: "minimal",
      template: {
        prefix:
          "당신은 전문 한국어 교정 편집자입니다. 다음 텍스트를 최소한의 필수적인 수정만 가하여 교정해 주세요.\n\n기본 맞춤법, 띄어쓰기, 문법 오류만 수정하고, 원문의 스타일과 어휘 선택은 최대한 유지하세요.\n\n다음 규칙과 지침을 참고하세요:\n\n{{KNOWLEDGE_RULES}}\n\n{{STYLE_GUIDES}}\n\n### 원문:\n{{ORIGINAL_TEXT}}",
        suffix:
          '\n\n### 출력 형식:\n```json\n{\n  "correctedText": "교정된 텍스트",\n  "corrections": [\n    {\n      "type": "교정 유형(spelling, grammar, style, punctuation, flow, foreign, other 중 하나)",\n      "original": "원본 텍스트",\n      "suggestion": "교정된 텍스트",\n      "explanation": "교정 이유 설명"\n    }\n  ]\n}\n```',
      },
      tags: ["grammar", "minimal"],
    },
    enhanced: {
      prompt_id: "proofread-enhanced",
      type: "correction",
      level: "enhanced",
      template: {
        prefix:
          "당신은 전문 한국어 교정 편집자입니다. 다음 텍스트를 포괄적으로 개선해 주세요.\n\n기본적인 맞춤법, 띄어쓰기, 문법 오류 수정은 물론, 더 명확하고 세련된 표현으로 개선하세요.\n문장 구조를 더 읽기 쉽게 재구성하고, 적절한 어휘로 대체하며, 논리적 흐름을 개선하세요.\n불필요한 반복은 제거하고, 전문적이고 세련된 문체로 변환해 주세요.\n\n다음 규칙과 지침을 참고하세요:\n\n{{KNOWLEDGE_RULES}}\n\n{{STYLE_GUIDES}}\n\n### 원문:\n{{ORIGINAL_TEXT}}",
        suffix:
          '\n\n### 출력 형식:\n```json\n{\n  "correctedText": "교정된 텍스트",\n  "corrections": [\n    {\n      "type": "교정 유형(spelling, grammar, style, punctuation, flow, foreign, other 중 하나)",\n      "original": "원본 텍스트",\n      "suggestion": "교정된 텍스트",\n      "explanation": "교정 이유 설명"\n    }\n  ]\n}\n```',
      },
      tags: ["grammar", "enhanced", "style"],
    },
    custom: {
      prompt_id: "proofread-custom",
      type: "correction",
      level: "custom",
      template: {
        prefix:
          "당신은 전문 한국어 교정 편집자입니다. 다음 텍스트를 교정해 주세요.\n\n{{USER_PREFERENCES}}\n\n다음 규칙과 지침을 참고하세요:\n\n{{KNOWLEDGE_RULES}}\n\n{{STYLE_GUIDES}}\n\n### 원문:\n{{ORIGINAL_TEXT}}",
        suffix:
          '\n\n### 출력 형식:\n```json\n{\n  "correctedText": "교정된 텍스트",\n  "corrections": [\n    {\n      "type": "교정 유형(spelling, grammar, style, punctuation, flow, foreign, other 중 하나)",\n      "original": "원본 텍스트",\n      "suggestion": "교정된 텍스트",\n      "explanation": "교정 이유 설명"\n    }\n  ]\n}\n```',
      },
      tags: ["grammar", "custom"],
    },
  };

  return defaultPrompts[level] || defaultPrompts.minimal;
}

module.exports = {
  selectPrompt,
};
