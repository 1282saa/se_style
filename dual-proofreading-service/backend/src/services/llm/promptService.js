const config = require("../../config");
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
 * LLM 프롬프트 생성 및 관리 서비스
 */
class PromptService {
  constructor() {
    this.templates = promptTemplates;
    logger.info("PromptService 초기화 완료");
  }

  /**
   * 교정 유형에 따른 프롬프트를 생성합니다.
   * @param {number} promptType - 프롬프트 유형 (1: 최소, 2: 적극적)
   * @param {string} originalText - 원문 텍스트
   * @param {Array} styleGuides - 관련 스타일 가이드 배열
   * @returns {Object} - 프롬프트 객체
   */
  generatePrompt(promptType, originalText, styleGuides = []) {
    // 프롬프트 템플릿 선택
    const template =
      promptType === 1 ? this.templates.minimal : this.templates.enhanced;

    // 스타일 가이드 컨텍스트 생성
    const styleGuideContext = this.formatStyleGuideContext(styleGuides);

    // 최종 프롬프트 생성
    const prompt = template
      .replace("{{ORIGINAL_TEXT}}", originalText)
      .replace("{{STYLE_GUIDES}}", styleGuideContext);

    logger.debug(
      `프롬프트 유형 ${promptType} 생성 완료 (길이: ${prompt.length}자)`
    );

    return prompt;
  }

  /**
   * 맞춤형 교정 프롬프트를 생성합니다.
   * @param {string} originalText - 원문 텍스트
   * @param {Array} styleGuides - 관련 스타일 가이드 배열
   * @param {Object} preferences - 사용자 선호도 설정
   * @returns {Object} - 프롬프트 객체
   */
  generateCustomPrompt(originalText, styleGuides = [], preferences = {}) {
    // 기본 프롬프트 템플릿
    let template = this.templates.custom;

    // 사용자 선호도 분석 및 적용
    const userPreferences = this.analyzePreferences(preferences);

    // 사용자 선호도 메시지 생성
    const preferencesMessage = this.formatPreferencesMessage(userPreferences);

    // 스타일 가이드 컨텍스트 생성
    const styleGuideContext = this.formatStyleGuideContext(styleGuides);

    // 최종 프롬프트 생성
    const prompt = template
      .replace("{{ORIGINAL_TEXT}}", originalText)
      .replace("{{STYLE_GUIDES}}", styleGuideContext)
      .replace("{{USER_PREFERENCES}}", preferencesMessage);

    logger.debug(`맞춤형 프롬프트 생성 완료 (길이: ${prompt.length}자)`);

    return prompt;
  }

  /**
   * 스타일 가이드를 프롬프트에 적합한 형식으로 변환합니다.
   * @param {Array} styleGuides - 스타일 가이드 배열
   * @returns {string} - 형식화된 스타일 가이드 문자열
   */
  formatStyleGuideContext(styleGuides) {
    if (!styleGuides || styleGuides.length === 0) {
      return "참조할 스타일 가이드가 없습니다.";
    }

    // 스타일 가이드를 텍스트로 변환
    const formattedGuides = styleGuides.map((guide) => {
      return `[${guide.category || "일반"}] ${guide.section}: ${guide.content}`;
    });

    // 최대 토큰 수 제한을 위한 처리
    const maxGuideLength = config.MAX_STYLE_GUIDE_LENGTH || 2000;
    let combinedGuides = formattedGuides.join("\n\n");

    if (combinedGuides.length > maxGuideLength) {
      // 길이 제한 초과 시 우선순위 높은 항목만 선택
      combinedGuides = formattedGuides
        .slice(0, Math.max(3, Math.floor(styleGuides.length / 2)))
        .join("\n\n");

      // 여전히 길이 초과 시 추가 자르기
      if (combinedGuides.length > maxGuideLength) {
        combinedGuides = combinedGuides.substring(0, maxGuideLength) + "...";
      }
    }

    return combinedGuides;
  }

  /**
   * 사용자 선호도를 분석합니다.
   * @param {Object} preferences - 사용자 선호도 설정
   * @returns {Object} - 분석된 선호도 객체
   */
  analyzePreferences(preferences = {}) {
    const defaultPreferences = {
      correctionLevel: "balanced", // minimal, balanced, enhanced
      focusAreas: ["spelling", "grammar"], // spelling, grammar, style, tone
      preserveStyle: true,
      formalityLevel: "neutral", // formal, neutral, casual
    };

    // 사용자 선호도 병합
    return {
      ...defaultPreferences,
      ...preferences,
    };
  }

  /**
   * 사용자 선호도를 프롬프트 메시지로 변환합니다.
   * @param {Object} preferences - 분석된 선호도 객체
   * @returns {string} - 선호도 메시지
   */
  formatPreferencesMessage(preferences) {
    // 교정 수준 메시지
    let levelMsg = "";
    switch (preferences.correctionLevel) {
      case "minimal":
        levelMsg = "최소한의 필수적인 교정만 수행하세요.";
        break;
      case "enhanced":
        levelMsg = "적극적으로 문체와 표현까지 개선하세요.";
        break;
      case "balanced":
      default:
        levelMsg = "균형 잡힌 수준으로 교정하세요.";
        break;
    }

    // 중점 영역 메시지
    let focusMsg = "";
    if (preferences.focusAreas && preferences.focusAreas.length > 0) {
      const areas = {
        spelling: "맞춤법",
        grammar: "문법",
        style: "문체",
        tone: "어조",
      };

      const focusAreas = preferences.focusAreas
        .map((area) => areas[area] || area)
        .join(", ");

      focusMsg = `특히 ${focusAreas}에 중점을 두고 교정하세요.`;
    }

    // 스타일 보존 메시지
    const styleMsg = preferences.preserveStyle
      ? "원문의 스타일과 어조를 최대한 유지하세요."
      : "필요하다면 스타일을 자유롭게 개선하세요.";

    // 격식 수준 메시지
    let formalityMsg = "";
    switch (preferences.formalityLevel) {
      case "formal":
        formalityMsg = "격식체로 교정하세요.";
        break;
      case "casual":
        formalityMsg = "비격식체로 자연스럽게 교정하세요.";
        break;
      case "neutral":
      default:
        formalityMsg = "중립적인 어조로 교정하세요.";
        break;
    }

    // 최종 메시지 구성
    return `${levelMsg} ${focusMsg} ${styleMsg} ${formalityMsg}`.trim();
  }

  /**
   * 프롬프트 길이를 확인하고 토큰 수 제한을 적용합니다.
   * @param {string} prompt - 원본 프롬프트
   * @param {number} maxTokens - 최대 토큰 수
   * @returns {string} - 제한된 프롬프트
   */
  limitPromptLength(prompt, maxTokens = config.TOKEN_LIMIT) {
    // 대략적인 토큰 수 추정 (한국어: 문자 수 / 1.5)
    const estimatedTokens = Math.ceil(prompt.length / 1.5);

    if (estimatedTokens <= maxTokens) {
      return prompt;
    }

    // 토큰 제한 초과 시 내용 절삭
    const exceededRatio = maxTokens / estimatedTokens;
    const newLength = Math.floor(prompt.length * exceededRatio * 0.95); // 안전 마진 5%

    return prompt.substring(0, newLength) + "...[내용이 너무 길어 일부 생략됨]";
  }
}

module.exports = new PromptService();
