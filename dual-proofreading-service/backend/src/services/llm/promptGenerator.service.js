// src/services/llm/promptGenerator.service.js
const logger = require("../../utils/logger");

class PromptGenerator {
  /**
   * 스타일북 규칙을 프롬프트에 포함하기 쉽게 포맷팅합니다.
   * @param {Array} rules - 스타일북 규칙 목록
   * @returns {string} - 포맷팅된 규칙 문자열
   */
  formatRules(rules) {
    if (!rules || rules.length === 0) {
      return "";
    }

    try {
      let formattedRules = "### 스타일 가이드 규칙:\n\n";

      rules.forEach((rule, index) => {
        // 현재 활성 버전 찾기
        const activeVersion =
          rule.versions.find((v) => v.status === "active") || rule.versions[0];

        if (!activeVersion) {
          logger.warn(`규칙 ${rule.rule_id}에 활성 버전이 없습니다.`);
          return;
        }

        const { structure } = activeVersion;

        // 규칙 제목 및 설명 추가
        formattedRules += `${index + 1}. **${structure.title}**\n`;
        formattedRules += `   설명: ${structure.description}\n`;

        // 태그가 있으면 추가
        if (structure.tags && structure.tags.length > 0) {
          formattedRules += `   태그: ${structure.tags.join(", ")}\n`;
        }

        // 가이드라인이 있으면 추가
        if (structure.guidelines && structure.guidelines.length > 0) {
          formattedRules += `   가이드라인:\n`;

          // 가이드라인 형식에 따라 처리
          if (Array.isArray(structure.guidelines)) {
            // 배열 형태인 경우
            structure.guidelines.forEach((guideline, guidelineIndex) => {
              if (typeof guideline === "string") {
                formattedRules += `     - ${guideline}\n`;
              } else if (typeof guideline === "object") {
                // 올바른/틀린 표현 쌍으로 된 경우
                if (guideline.incorrect && guideline.correct) {
                  formattedRules += `     - 틀린 표현: "${guideline.incorrect}" / 올바른 표현: "${guideline.correct}"\n`;
                  if (guideline.explanation) {
                    formattedRules += `       설명: ${guideline.explanation}\n`;
                  }
                } else if (guideline.comparison_pairs) {
                  // 비교 쌍이 있는 경우
                  guideline.comparison_pairs.forEach((pair) => {
                    formattedRules += `     - 비교: ${
                      pair.pair ? pair.pair.join(" vs ") : "없음"
                    }\n`;
                    if (pair.distinctions) {
                      pair.distinctions.forEach((dist) => {
                        formattedRules += `       * ${dist.word}: ${dist.meaning}\n`;
                      });
                    }
                  });
                } else {
                  // 기타 객체 형태
                  const guidelineStr = Object.entries(guideline)
                    .map(([key, value]) => `${key}: ${value}`)
                    .join(", ");
                  formattedRules += `     - ${guidelineStr}\n`;
                }
              }
            });
          } else if (typeof structure.guidelines === "object") {
            // 객체 형태인 경우 (예: 카테고리별 규칙)
            Object.entries(structure.guidelines).forEach(
              ([category, categoryGuidelines]) => {
                formattedRules += `     [${category}]\n`;
                if (Array.isArray(categoryGuidelines)) {
                  categoryGuidelines.forEach((guideline) => {
                    formattedRules += `     - ${guideline}\n`;
                  });
                } else {
                  formattedRules += `     - ${categoryGuidelines}\n`;
                }
              }
            );
          }
        }

        // 예시나 힌트가 있으면 추가
        if (structure.hint) {
          formattedRules += `   힌트: ${structure.hint}\n`;
        }

        formattedRules += "\n";
      });

      return formattedRules;
    } catch (error) {
      logger.error(`규칙 포맷팅 오류: ${error.message}`);
      return "### 스타일 가이드 규칙을 불러오는 중 오류가 발생했습니다.";
    }
  }

  /**
   * 최소한의 교정을 위한 프롬프트 생성 (프롬프트1)
   * @param {string} originalText - 원문 텍스트
   * @param {Array} relevantRules - 관련 스타일북 규칙
   * @returns {string} - 생성된 프롬프트
   */
  generatePrompt1(originalText, relevantRules) {
    const formattedRules = this.formatRules(relevantRules);

    return `당신은 전문 한국어 교정 편집자입니다. 다음 텍스트를 최소한의 필수적인 수정만 가하여 교정해 주세요.

기본 맞춤법, 띄어쓰기, 문법 오류만 수정하고, 원문의 스타일과 어휘 선택은 최대한 유지하세요.

${formattedRules ? formattedRules : ""}

### 원문:
${originalText}

### 교정본:`;
  }

  /**
   * 적극적인 교정을 위한 프롬프트 생성 (프롬프트2)
   * @param {string} originalText - 원문 텍스트
   * @param {Array} relevantRules - 관련 스타일북 규칙
   * @returns {string} - 생성된 프롬프트
   */
  generatePrompt2(originalText, relevantRules) {
    const formattedRules = this.formatRules(relevantRules);

    return `당신은 전문 한국어 교정 편집자입니다. 다음 텍스트를 포괄적으로 개선해 주세요.

기본적인 맞춤법, 띄어쓰기, 문법 오류 수정은 물론, 더 명확하고 세련된 표현으로 개선하세요.
문장 구조를 더 읽기 쉽게 재구성하고, 적절한 어휘로 대체하며, 논리적 흐름을 개선하세요.
불필요한 반복은 제거하고, 전문적이고 세련된 문체로 변환해 주세요.

${formattedRules ? formattedRules : ""}

### 원문:
${originalText}

### 개선본:`;
  }

  /**
   * 사용자 선호도를 반영한 맞춤형 교정 프롬프트 생성
   * @param {string} originalText - 원문 텍스트
   * @param {Array} relevantRules - 관련 스타일북 규칙
   * @param {Object} userPreferences - 사용자 선호도 정보
   * @returns {string} - 생성된 프롬프트
   */
  generateCustomPrompt(originalText, relevantRules, userPreferences) {
    const formattedRules = this.formatRules(relevantRules);
    const { preferredStyle = "neutral" } = userPreferences;

    let styleInstruction = "";

    // 사용자 선호 스타일에 따른 지시문 생성
    if (preferredStyle === "minimal") {
      styleInstruction = `사용자는 최소한의 교정을 선호합니다. 기본 맞춤법, 띄어쓰기, 문법 오류만 수정하고, 원문의 스타일과 어휘 선택은 최대한 유지하세요.`;
    } else if (preferredStyle === "extensive") {
      styleInstruction = `사용자는 적극적인 교정을 선호합니다. 기본적인 맞춤법, 띄어쓰기, 문법 오류 수정은 물론, 더 명확하고 세련된 표현으로 개선하세요. 문장 구조를 더 읽기 쉽게 재구성하고, 적절한 어휘로 대체하며, 논리적 흐름을 개선하세요.`;
    } else {
      styleInstruction = `기본 맞춤법, 띄어쓰기, 문법 오류를 수정하고 필요한 경우 문장을 더 명확하게 개선하세요. 원문의 의미는 유지하면서 읽기 쉽게 만드세요.`;
    }

    return `당신은 전문 한국어 교정 편집자입니다. 다음 텍스트를 교정해 주세요.

${styleInstruction}

${formattedRules ? formattedRules : ""}

### 원문:
${originalText}

### 교정본:`;
  }
}

module.exports = new PromptGenerator();
