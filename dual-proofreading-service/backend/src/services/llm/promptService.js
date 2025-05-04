// src/services/llm/promptGenerator.service.js
const logger = require("../../utils/logger");

class PromptGeneratorService {
  /**
   * 스타일 가이드를 프롬프트에 포함할 수 있는 형식으로 변환합니다.
   * @param {Array} styleGuides - 스타일 가이드 배열
   * @returns {string} - 포맷팅된 스타일 가이드 텍스트
   */
  formatStyleGuides(styleGuides) {
    if (!styleGuides || styleGuides.length === 0) {
      return "";
    }

    try {
      let formattedText = "## 참고해야 할 스타일 가이드:\n\n";

      styleGuides.forEach((guide, index) => {
        formattedText += `### ${index + 1}. ${guide.section}\n`;
        formattedText += `${guide.content}\n\n`;

        // 태그가 있으면 추가
        if (guide.tags && guide.tags.length > 0) {
          formattedText += `*관련 태그: ${guide.tags.join(", ")}*\n\n`;
        }
      });

      return formattedText;
    } catch (error) {
      logger.error(`스타일 가이드 포맷팅 오류: ${error.message}`);
      return "## 참고해야 할 스타일 가이드 정보를 불러오는 데 실패했습니다.";
    }
  }

  /**
   * 최소한의 교정을 위한 프롬프트를 생성합니다. (프롬프트 유형 1)
   * @param {string} text - 교정할 원문 텍스트
   * @param {Array} styleGuides - 관련 스타일 가이드
   * @returns {string} - 완성된 프롬프트
   */
  generateMinimalPrompt(text, styleGuides = []) {
    const formattedGuides = this.formatStyleGuides(styleGuides);

    const prompt = `
# 한국어 텍스트 최소 교정 요청

## 교정 지침

당신은 한국어 텍스트 교정 전문가입니다. 다음 텍스트의 맞춤법, 띄어쓰기, 문법적 오류만 최소한으로 수정해주세요.

### 주요 교정 원칙:
1. 맞춤법, 띄어쓰기, 문법적 오류만 수정하세요.
2. 원문의 문체와 어휘 선택은 최대한 유지하세요.
3. 내용을 추가하거나 삭제하지 마세요.
4. 문장 구조를 크게 변경하지 마세요.
5. 문장 순서를 바꾸지 마세요.
6. 지나치게 간결하게 만들거나 확장하지 마세요.

${formattedGuides}

## 원문:
${text}

## 교정본:
`;

    return prompt;
  }

  /**
   * 적극적인 교정을 위한 프롬프트를 생성합니다. (프롬프트 유형 2)
   * @param {string} text - 교정할 원문 텍스트
   * @param {Array} styleGuides - 관련 스타일 가이드
   * @returns {string} - 완성된 프롬프트
   */
  generateEnhancedPrompt(text, styleGuides = []) {
    const formattedGuides = this.formatStyleGuides(styleGuides);

    const prompt = `
# 한국어 텍스트 적극적 교정 요청

## 교정 지침

당신은 한국어 텍스트 교정 전문가입니다. 다음 텍스트를 포괄적으로 개선하여 더 명확하고 효과적으로 만들어주세요.

### 주요 교정 원칙:
1. 맞춤법, 띄어쓰기, 문법적 오류를 수정하세요.
2. 어색한 표현이나 문장 구조를 자연스럽게 개선하세요.
3. 중복되거나 불필요한 표현을 제거하세요.
4. 어휘 선택을 더 정확하고 적절하게 개선하세요.
5. 문장 간의 연결을 자연스럽게 다듬어 가독성을 높이세요.
6. 전체적인 문체의 일관성을 유지하세요.
7. 내용의 핵심은 유지하되, 표현 방식을 적극적으로 개선하세요.

${formattedGuides}

## 원문:
${text}

## 교정본:
`;

    return prompt;
  }

  /**
   * 사용자 맞춤형 교정을 위한 프롬프트를 생성합니다.
   * @param {string} text - 교정할 원문 텍스트
   * @param {Array} styleGuides - 관련 스타일 가이드
   * @param {Object} preferences - 사용자 선호사항
   * @returns {string} - 완성된 프롬프트
   */
  generateCustomPrompt(text, styleGuides = [], preferences = {}) {
    const formattedGuides = this.formatStyleGuides(styleGuides);

    // 기본 교정 수준 설정
    let correctionLevel = preferences.correctionLevel || "medium";
    let correctionGuidelines = "";

    // 교정 수준에 따른 지침 설정
    switch (correctionLevel) {
      case "minimal":
        correctionGuidelines = `
1. 맞춤법, 띄어쓰기, 문법적 오류만 수정하세요.
2. 원문의 문체와 어휘 선택은 최대한 유지하세요.
3. 내용을 추가하거나 삭제하지 마세요.
4. 문장 구조를 변경하지 마세요.`;
        break;

      case "aggressive":
        correctionGuidelines = `
1. 맞춤법, 띄어쓰기, 문법적 오류를 철저히 수정하세요.
2. 어색한 표현과 문장 구조를 적극적으로 개선하세요.
3. 중복되거나 불필요한 표현을 과감히 제거하세요.
4. 어휘 선택을 더 정확하고 효과적으로 개선하세요.
5. 문장 간의 연결을 자연스럽게 다듬어 가독성을 높이세요.
6. 필요하다면 문단 구성도 최적화하세요.`;
        break;

      default: // medium
        correctionGuidelines = `
1. 맞춤법, 띄어쓰기, 문법적 오류를 수정하세요.
2. 명확성을 해치는 어색한 표현을 개선하세요.
3. 중복되는 표현을 정리하세요.
4. 문장 구조가 복잡한 경우 간결하게 다듬으세요.
5. 전체적인 문체의 일관성을 유지하세요.`;
    }

    // 추가 선호사항 적용
    if (preferences.formalStyle) {
      correctionGuidelines += `\n6. 공식적이고 격식있는 문체를 사용하세요.`;
    }

    if (preferences.conciseStyle) {
      correctionGuidelines += `\n7. 간결하고 명확한 문체로 작성하세요.`;
    }

    if (preferences.avoidForeignWords) {
      correctionGuidelines += `\n8. 가능한 외래어 대신 순우리말을 사용하세요.`;
    }

    const prompt = `
# 맞춤형 한국어 텍스트 교정 요청

## 교정 지침

당신은 한국어 텍스트 교정 전문가입니다. 다음 텍스트를 사용자의 선호도에 맞춰 교정해주세요.

### 주요 교정 원칙:
${correctionGuidelines}

${formattedGuides}

## 원문:
${text}

## 교정본:
`;

    return prompt;
  }

  /**
   * 프롬프트 유형에 따라 적절한 프롬프트를 생성합니다.
   * @param {number} promptType - 프롬프트 유형 (1: 최소, 2: 적극적)
   * @param {string} text - 교정할 원문 텍스트
   * @param {Array} styleGuides - 관련 스타일 가이드
   * @param {Object} preferences - 사용자 선호사항 (선택 사항)
   * @returns {string} - 생성된 프롬프트
   */
  generatePrompt(promptType, text, styleGuides = [], preferences = {}) {
    switch (promptType) {
      case 1:
        return this.generateMinimalPrompt(text, styleGuides);
      case 2:
        return this.generateEnhancedPrompt(text, styleGuides);
      case 3: // 맞춤형
        return this.generateCustomPrompt(text, styleGuides, preferences);
      default:
        logger.warn(
          `알 수 없는 프롬프트 유형: ${promptType}, 기본값(최소 교정) 사용`
        );
        return this.generateMinimalPrompt(text, styleGuides);
    }
  }
}

module.exports = new PromptGeneratorService();
