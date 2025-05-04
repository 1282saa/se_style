// src/services/llm/promptService.js
const logger = require("../../utils/logger");

/**
 * 프롬프트 템플릿 정의
 */
const promptTemplates = {
  minimal: `당신은 전문 한국어 교정 편집자입니다. 다음 텍스트를 최소한의 필수적인 수정만 가하여 교정해 주세요.

기본 맞춤법, 띄어쓰기, 문법 오류만 수정하고, 원문의 스타일과 어휘 선택은 최대한 유지하세요.

{{STYLE_GUIDES}}

### 원문:
{{ORIGINAL_TEXT}}

### 출력 형식:
{
  "correctedText": "교정된 텍스트",
  "corrections": [
    {
      "type": "교정 유형(spelling, grammar, style, punctuation, flow, foreign, other 중 하나)",
      "originalText": "원본 텍스트",
      "correctedText": "교정된 텍스트",
      "explanation": "교정 이유 설명"
    }
  ]
}`,

  enhanced: `당신은 전문 한국어 교정 편집자입니다. 다음 텍스트를 포괄적으로 개선해 주세요.

기본적인 맞춤법, 띄어쓰기, 문법 오류 수정은 물론, 더 명확하고 세련된 표현으로 개선하세요.
문장 구조를 더 읽기 쉽게 재구성하고, 적절한 어휘로 대체하며, 논리적 흐름을 개선하세요.
불필요한 반복은 제거하고, 전문적이고 세련된 문체로 변환해 주세요.

{{STYLE_GUIDES}}

### 원문:
{{ORIGINAL_TEXT}}

### 출력 형식:
{
  "correctedText": "교정된 텍스트",
  "corrections": [
    {
      "type": "교정 유형(spelling, grammar, style, punctuation, flow, foreign, other 중 하나)",
      "originalText": "원본 텍스트",
      "correctedText": "교정된 텍스트",
      "explanation": "교정 이유 설명"
    }
  ]
}`,

  custom: `당신은 전문 한국어 교정 편집자입니다. 다음 텍스트를 교정해 주세요.

{{USER_PREFERENCES}}

{{STYLE_GUIDES}}

### 원문:
{{ORIGINAL_TEXT}}

### 출력 형식:
{
  "correctedText": "교정된 텍스트",
  "corrections": [
    {
      "type": "교정 유형(spelling, grammar, style, punctuation, flow, foreign, other 중 하나)",
      "originalText": "원본 텍스트",
      "correctedText": "교정된 텍스트",
      "explanation": "교정 이유 설명"
    }
  ]
}`,
};

/**
 * 프롬프트 생성 서비스
 * - 다양한 교정 유형에 맞는 프롬프트 생성
 * - 스타일 가이드 활용 및 포맷팅
 */
class PromptService {
  constructor() {
    this.templates = promptTemplates;
    logger.info("PromptService 초기화 완료");
  }

  /**
   * 스타일 가이드를 프롬프트에 포함할 수 있는 형식으로 변환
   * @param {Array} styleGuides - 스타일 가이드 배열
   * @returns {string} - 포맷팅된 스타일 가이드 텍스트
   */
  formatStyleGuides(styleGuides) {
    if (
      !styleGuides ||
      !Array.isArray(styleGuides) ||
      styleGuides.length === 0
    ) {
      return "";
    }

    try {
      // 스타일 가이드 최대 개수 제한 (토큰 수 제한을 위해)
      const maxGuides = 5;
      const limitedGuides = styleGuides.slice(0, maxGuides);

      let formattedGuides = "### 스타일 가이드 규칙:\n\n";

      limitedGuides.forEach((guide, index) => {
        try {
          // 버전이 있는 경우와 없는 경우를 모두 처리
          const activeVersion =
            guide.versions && Array.isArray(guide.versions)
              ? guide.versions.find((v) => v.status === "active") ||
                guide.versions[0]
              : null;

          const structure = activeVersion ? activeVersion.structure : guide;
          const title = structure.title || guide.section || "규칙";
          const description = structure.description || guide.content || "";

          // 우선순위가 있는 경우 표시 (1: 지식, 2: 참고, 3: 제안, 4: 권고, 5: 필수)
          const priorityLabels = {
            1: "참고",
            2: "권장",
            3: "중요",
            4: "필수",
            5: "핵심",
          };
          const priority = guide.priority || 3; // 기본값: 중요
          const priorityLabel = priorityLabels[priority] || "중요";

          // 규칙 제목 및 설명 추가
          formattedGuides += `${index + 1}. **${title}** (${priorityLabel})\n`;

          if (description) {
            formattedGuides += `   설명: ${description}\n`;
          }

          // 태그가 있으면 추가
          const tags = structure.tags || guide.tags;
          if (tags && Array.isArray(tags) && tags.length > 0) {
            formattedGuides += `   태그: ${tags.join(", ")}\n`;
          }

          // 가이드라인 처리
          this.addGuidelinesFormat(formattedGuides, structure);

          // 힌트 추가
          if (structure.hint) {
            formattedGuides += `   힌트: ${structure.hint}\n`;
          }

          formattedGuides += "\n";
        } catch (guideError) {
          logger.warn(`규칙 #${index + 1} 포맷팅 오류: ${guideError.message}`);
          formattedGuides += `${
            index + 1
          }. **규칙 정보 처리 중 오류 발생**\n\n`;
        }
      });

      // 스타일 가이드가 최대 개수보다 많을 경우 알림
      if (styleGuides.length > maxGuides) {
        formattedGuides += `\n* 참고: 총 ${styleGuides.length}개 중 ${maxGuides}개의 가장 관련성 높은 규칙만 표시됩니다.\n`;
      }

      return formattedGuides;
    } catch (error) {
      logger.error(`스타일 가이드 포맷팅 오류: ${error.message}`);
      return "### 스타일 가이드 규칙 처리 중 오류가 발생했습니다.\n";
    }
  }

  /**
   * 가이드라인 포맷팅을 추가합니다.
   * @param {string} formattedText - 포맷팅 중인 텍스트
   * @param {Object} structure - 규칙 구조
   * @private
   */
  addGuidelinesFormat(formattedText, structure) {
    const guidelines = structure.guidelines;
    if (!guidelines || (Array.isArray(guidelines) && guidelines.length === 0)) {
      return;
    }

    formattedText += `   가이드라인:\n`;

    try {
      // 가이드라인 형식에 따라 처리
      if (Array.isArray(guidelines)) {
        guidelines.forEach((guideline) => {
          if (typeof guideline === "string") {
            formattedText += `     - ${guideline}\n`;
          } else if (typeof guideline === "object" && guideline !== null) {
            this.formatGuidelineObject(formattedText, guideline);
          }
        });
      } else if (typeof guidelines === "object" && guidelines !== null) {
        // 객체 형태인 경우 (카테고리별 규칙)
        Object.entries(guidelines).forEach(([category, categoryGuidelines]) => {
          formattedText += `     [${category}]\n`;
          if (Array.isArray(categoryGuidelines)) {
            categoryGuidelines.forEach((guideline) => {
              formattedText += `     - ${guideline}\n`;
            });
          } else {
            formattedText += `     - ${categoryGuidelines}\n`;
          }
        });
      }
    } catch (error) {
      logger.warn(`가이드라인 포맷팅 오류: ${error.message}`);
      formattedText += `     - 가이드라인 처리 중 오류 발생\n`;
    }
  }

  /**
   * 가이드라인 객체를 포맷팅합니다.
   * @param {string} formattedText - 포맷팅 중인 텍스트
   * @param {Object} guideline - 가이드라인 객체
   * @private
   */
  formatGuidelineObject(formattedText, guideline) {
    // 올바른/틀린 표현 쌍
    if (guideline.incorrect && guideline.correct) {
      formattedText += `     - 틀린 표현: "${guideline.incorrect}" / 올바른 표현: "${guideline.correct}"\n`;
      if (guideline.explanation) {
        formattedText += `       설명: ${guideline.explanation}\n`;
      }
    }
    // 비교 쌍
    else if (
      guideline.comparison_pairs &&
      Array.isArray(guideline.comparison_pairs)
    ) {
      guideline.comparison_pairs.forEach((pair) => {
        formattedText += `     - 비교: ${
          pair.pair ? pair.pair.join(" vs ") : "없음"
        }\n`;
        if (pair.distinctions && Array.isArray(pair.distinctions)) {
          pair.distinctions.forEach((dist) => {
            formattedText += `       * ${dist.word}: ${dist.meaning}\n`;
          });
        }
      });
    }
    // 기타 객체 형태
    else {
      const guidelineStr = Object.entries(guideline)
        .map(([key, value]) => `${key}: ${value}`)
        .join(", ");
      formattedText += `     - ${guidelineStr}\n`;
    }
  }

  /**
   * 선호 스타일에 따른 지시문을 생성합니다.
   * @param {Object} userPreferences - 사용자 선호도 설정
   * @returns {string} - 생성된 지시문
   * @private
   */
  generateUserPreferencesText(userPreferences) {
    const {
      preferredStyle = "neutral",
      formality,
      conciseness,
    } = userPreferences || {};

    let instructions = [];

    // 기본 교정 수준 지시문
    if (preferredStyle === "minimal") {
      instructions.push(
        "사용자는 최소한의 교정을 선호합니다. 기본 맞춤법, 띄어쓰기, 문법 오류만 수정하고, 원문의 스타일과 어휘 선택은 최대한 유지하세요."
      );
    } else if (preferredStyle === "extensive") {
      instructions.push(
        "사용자는 적극적인 교정을 선호합니다. 기본적인 맞춤법, 띄어쓰기, 문법 오류 수정은 물론, 더 명확하고 세련된 표현으로 개선하세요. 문장 구조를 더 읽기 쉽게 재구성하고, 적절한 어휘로 대체하며, 논리적 흐름을 개선하세요."
      );
    } else {
      instructions.push(
        "기본 맞춤법, 띄어쓰기, 문법 오류를 수정하고 필요한 경우 문장을 더 명확하게 개선하세요. 원문의 의미는 유지하면서 읽기 쉽게 만드세요."
      );
    }

    // 추가 스타일 지시문
    if (formality === "formal") {
      instructions.push("공식적이고 격식있는 문체를 사용하세요.");
    } else if (formality === "informal") {
      instructions.push("친근하고 자연스러운 문체를 사용하세요.");
    }

    if (conciseness === "concise") {
      instructions.push("간결하고 명확한 문체로 작성하세요.");
    } else if (conciseness === "detailed") {
      instructions.push("풍부하고 상세한 표현을 사용하세요.");
    }

    return instructions.join(" ");
  }

  /**
   * 프롬프트를 생성합니다.
   * @param {number|string} type - 프롬프트 유형 (1/minimal: 최소, 2/enhanced: 적극적, 3/custom: 맞춤형)
   * @param {string} originalText - 원문 텍스트
   * @param {Array} styleGuides - 스타일 가이드 배열
   * @param {Object} userPreferences - 사용자 선호도 설정 (맞춤형 교정 시 사용)
   * @returns {string} - 생성된 프롬프트
   */
  generatePrompt(type, originalText, styleGuides = [], userPreferences = {}) {
    try {
      // 입력 유효성 검사
      if (!originalText) {
        throw new Error("원문 텍스트가 제공되지 않았습니다.");
      }

      // 텍스트 길이 제한 (토큰 수 제한을 위해)
      const maxLength = 10000;
      const limitedText =
        originalText.length > maxLength
          ? originalText.substring(0, maxLength) + "..."
          : originalText;

      logger.info(
        `프롬프트 유형 ${type} 생성 시작 (텍스트 길이: ${limitedText.length}자)`
      );

      // 프롬프트 유형 결정 및 템플릿 선택
      let templateKey;
      let replacements = {
        "{{ORIGINAL_TEXT}}": limitedText,
        "{{STYLE_GUIDES}}": this.formatStyleGuides(styleGuides),
      };

      switch (String(type).toLowerCase()) {
        case "1":
        case "minimal":
          templateKey = "minimal";
          break;

        case "2":
        case "enhanced":
          templateKey = "enhanced";
          break;

        case "3":
        case "custom":
          templateKey = "custom";
          replacements["{{USER_PREFERENCES}}"] =
            this.generateUserPreferencesText(userPreferences);
          break;

        default:
          logger.warn(
            `알 수 없는 프롬프트 유형: ${type}, 기본값(minimal) 사용`
          );
          templateKey = "minimal";
      }

      // 템플릿에 변수 적용
      let prompt = this.templates[templateKey];
      for (const [key, value] of Object.entries(replacements)) {
        prompt = prompt.replace(key, value);
      }

      logger.info(
        `프롬프트 유형 ${templateKey} 생성 완료 (길이: ${prompt.length}자)`
      );
      return prompt;
    } catch (error) {
      logger.error(`프롬프트 생성 오류: ${error.message}`);
      // 최소한의 프롬프트 생성 (오류 복구)
      return `당신은 전문 한국어 교정 편집자입니다. 다음 텍스트의 맞춤법, 띄어쓰기, 문법 오류를 수정해 주세요.\n\n### 원문:\n${originalText}\n\n### 교정본:`;
    }
  }

  /**
   * 최소한의 교정을 위한 프롬프트 생성 (타입 1)
   * @param {string} originalText - 원문 텍스트
   * @param {Array} styleGuides - 스타일 가이드 배열
   * @returns {string} - 생성된 프롬프트
   */
  generateMinimalPrompt(originalText, styleGuides = []) {
    return this.generatePrompt("minimal", originalText, styleGuides);
  }

  /**
   * 적극적인 교정을 위한 프롬프트 생성 (타입 2)
   * @param {string} originalText - 원문 텍스트
   * @param {Array} styleGuides - 스타일 가이드 배열
   * @returns {string} - 생성된 프롬프트
   */
  generateEnhancedPrompt(originalText, styleGuides = []) {
    return this.generatePrompt("enhanced", originalText, styleGuides);
  }

  /**
   * 맞춤형 교정을 위한 프롬프트 생성 (타입 3)
   * @param {string} originalText - 원문 텍스트
   * @param {Array} styleGuides - 스타일 가이드 배열
   * @param {Object} userPreferences - 사용자 선호도 설정
   * @returns {string} - 생성된 프롬프트
   */
  generateCustomPrompt(originalText, styleGuides = [], userPreferences = {}) {
    return this.generatePrompt(
      "custom",
      originalText,
      styleGuides,
      userPreferences
    );
  }
}

module.exports = new PromptService();
