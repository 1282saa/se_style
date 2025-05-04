const logger = require("../../utils/logger");

/**
 * 프롬프트 생성기 클래스
 */
class PromptGenerator {
  /**
   * 교정 프롬프트 생성
   * @param {string} text - 교정할 텍스트
   * @param {string} type - 교정 유형 ('minimal' 또는 'active')
   * @param {Array} styleGuides - 관련 스타일 가이드 목록 (선택 사항)
   * @returns {string} - 생성된 프롬프트
   */
  generatePrompt(text, type = "minimal", styleGuides = []) {
    try {
      logger.info(`[PromptGenerator] ${type} 교정용 프롬프트 생성 시작`);

      // 기본 지시사항
      let baseInstructions = `한국어 텍스트를 교정해주세요. `;

      // 교정 유형에 따른 지시사항 추가
      if (type === "minimal") {
        baseInstructions += `
필수적인 교정만 수행하세요:
- 맞춤법, 띄어쓰기, 문법 오류만 수정합니다.
- 문체나 표현은 원문 그대로 유지합니다.
- 외래어 표기법 오류를 수정합니다.
- 명백한 사실 오류만 수정합니다.`;
      } else if (type === "active") {
        baseInstructions += `
포괄적인 교정을 수행하세요:
- 맞춤법, 띄어쓰기, 문법 오류를 수정합니다.
- 문체와 표현을 자연스럽게 개선합니다.
- 외래어 표기법 오류를 수정합니다.
- 문장 구조를 개선하고 불필요한 중복을 제거합니다.
- 사실 오류를 수정합니다.
- 논리적 일관성을 확보합니다.`;
      }

      // 스타일 가이드 정보 추가
      if (styleGuides && styleGuides.length > 0) {
        baseInstructions += `\n\n다음 스타일 가이드를 따라 교정하세요:\n`;

        styleGuides.forEach((guide, index) => {
          baseInstructions += `${index + 1}. ${guide.section}: ${
            guide.content
          }\n`;
        });
      }

      // 출력 형식 지정
      baseInstructions += `\n출력 형식:
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
}`;

      // 최종 프롬프트 구성
      const prompt = `${baseInstructions}\n\n원문:\n${text}`;

      logger.info(`[PromptGenerator] ${type} 교정용 프롬프트 생성 완료`);
      return prompt;
    } catch (error) {
      logger.error(
        `[PromptGenerator] 프롬프트 생성 중 오류 발생: ${error.message}`
      );
      throw new Error(`프롬프트 생성 중 오류 발생: ${error.message}`);
    }
  }
}

module.exports = new PromptGenerator();
