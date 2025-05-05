const logger = require("../../utils/logger");
const config = require("../../config");
const knowledgeService = require("../knowledgeService");

/**
 * 프롬프트 템플릿에 변수를 삽입하여 최종 프롬프트를 생성합니다.
 * @param {Object} template - 프롬프트 템플릿 (prefix, suffix 포함)
 * @param {Object} variables - 삽입할 변수 객체
 * @param {Object} options - 추가 옵션
 * @returns {string} - 생성된 최종 프롬프트
 */
function buildPrompt(template, variables = {}, options = {}) {
  try {
    const {
      maxTotalLength = config.TOKEN_LIMIT || 16000,
      formatStyleGuides = true,
    } = options;

    if (!template || !template.prefix) {
      logger.error("유효하지 않은 프롬프트 템플릿");
      return "";
    }

    // 변수 준비
    const vars = { ...variables };

    // 스타일 가이드 포맷팅
    if (
      formatStyleGuides &&
      vars.STYLE_GUIDES &&
      Array.isArray(vars.STYLE_GUIDES)
    ) {
      vars.STYLE_GUIDES = formatStyleGuideList(vars.STYLE_GUIDES);
    }

    // 템플릿 변수 치환 (prefix)
    let prompt = template.prefix;
    for (const [key, value] of Object.entries(vars)) {
      const placeholder = `{{${key}}}`;
      if (prompt.includes(placeholder)) {
        prompt = prompt.replace(placeholder, value);
      }
    }

    // 템플릿 변수 치환 (suffix)
    let suffix = template.suffix || "";
    for (const [key, value] of Object.entries(vars)) {
      const placeholder = `{{${key}}}`;
      if (suffix.includes(placeholder)) {
        suffix = suffix.replace(placeholder, value);
      }
    }

    // 최종 프롬프트 구성
    let finalPrompt = prompt + suffix;

    // 최대 길이 제한 처리
    if (finalPrompt.length > maxTotalLength) {
      // 원본 텍스트와 스타일 가이드 길이 계산
      const originalTextPlaceholder = "{{ORIGINAL_TEXT}}";
      const styleGuidesPlaceholder = "{{STYLE_GUIDES}}";

      const originalText = vars.ORIGINAL_TEXT || "";
      const styleGuides = vars.STYLE_GUIDES || "";

      // 원본 텍스트를 줄여야 하는 경우
      if (originalText && originalText.length > 1000) {
        const availableLength =
          maxTotalLength -
          (template.prefix.length - originalTextPlaceholder.length) -
          template.suffix.length -
          styleGuides.length -
          100; // 안전 마진

        if (availableLength > 0 && availableLength < originalText.length) {
          const truncatedText =
            originalText.substring(0, availableLength) +
            "...(긴 텍스트 일부 생략)";

          finalPrompt =
            template.prefix.replace(originalTextPlaceholder, truncatedText) +
            template.suffix;

          // 다른 변수들도 대체
          for (const [key, value] of Object.entries(vars)) {
            if (key !== "ORIGINAL_TEXT") {
              const placeholder = `{{${key}}}`;
              if (finalPrompt.includes(placeholder)) {
                finalPrompt = finalPrompt.replace(placeholder, value);
              }
            }
          }
        }
      }

      // 그래도 길이 초과시 간단하게 자르기
      if (finalPrompt.length > maxTotalLength) {
        logger.warn(
          `프롬프트가 최대 길이를 초과하여 잘림: ${finalPrompt.length} > ${maxTotalLength}`
        );
        finalPrompt = finalPrompt.substring(0, maxTotalLength);
      }
    }

    return finalPrompt;
  } catch (error) {
    logger.error(`프롬프트 생성 오류: ${error.message}`);
    // 최소한의 프롬프트 반환
    return `당신은 전문 한국어 교정 편집자입니다. 다음 텍스트의 맞춤법, 띄어쓰기, 문법 오류를 수정해 주세요.\n\n### 원문:\n${
      variables.ORIGINAL_TEXT || "(원문 누락)"
    }\n\n### 교정본:`;
  }
}

/**
 * 스타일 가이드 배열을 프롬프트용 텍스트로 포맷팅합니다.
 * @param {Array} styleGuides - 스타일 가이드 배열
 * @returns {string} - 포맷팅된 스타일 가이드 텍스트
 * @private
 */
function formatStyleGuideList(styleGuides) {
  if (!styleGuides || styleGuides.length === 0) {
    return "### 스타일 가이드: 참조할 스타일 가이드가 없습니다.";
  }

  try {
    let formattedGuides = "### 스타일 가이드 규칙:\n\n";

    // 우선순위별로 스타일 가이드 정렬
    const sortedGuides = [...styleGuides].sort((a, b) => {
      // 높은 priority 값이 먼저 오도록 정렬 (5: 필수 > 1: 지식)
      return (b.priority || 3) - (a.priority || 3);
    });

    // 최대 10개로 제한
    const limitedGuides = sortedGuides.slice(0, 10);

    // 우선순위 레이블 정의
    const priorityLabels = {
      1: "[참고]",
      2: "[권장]",
      3: "[중요]",
      4: "[권고]",
      5: "[필수]",
    };

    // 스타일 가이드 포맷팅
    limitedGuides.forEach((guide, index) => {
      const priority = guide.priority || 3;
      const priorityLabel = priorityLabels[priority] || "[중요]";

      formattedGuides += `${index + 1}. ${priorityLabel} `;

      if (guide.title || guide.section) {
        formattedGuides += `**${guide.title || guide.section}**`;
      }

      if (guide.category) {
        formattedGuides += ` (${guide.category})`;
      }

      formattedGuides += "\n";

      if (guide.content) {
        formattedGuides += `   ${guide.content}\n`;
      }

      // 태그가 있으면 추가
      if (guide.tags && Array.isArray(guide.tags) && guide.tags.length > 0) {
        formattedGuides += `   태그: ${guide.tags.join(", ")}\n`;
      }

      formattedGuides += "\n";
    });

    // 가이드가 제한되었음을 알림
    if (styleGuides.length > limitedGuides.length) {
      formattedGuides += `* 참고: 총 ${styleGuides.length}개 중 ${limitedGuides.length}개의 가장 관련성 높은 규칙만 표시됩니다.\n`;
    }

    return formattedGuides;
  } catch (error) {
    logger.error(`스타일 가이드 포맷팅 오류: ${error.message}`);
    return "### 스타일 가이드: 스타일 가이드 처리 중 오류가 발생했습니다.";
  }
}

/**
 * 사용자 선호도에 따른 지시문을 생성합니다.
 * @param {Object} preferences - 사용자 선호도 설정
 * @returns {string} - 지시문 텍스트
 */
function generatePreferencesText(preferences = {}) {
  const {
    preferredStyle = "neutral",
    formality = "neutral",
    conciseness = "neutral",
    customSettings = {},
  } = preferences;

  let instructions = [];

  // 기본 교정 스타일 지시문
  switch (preferredStyle) {
    case "minimal":
      instructions.push(
        "최소한의 교정만 수행하세요. 기본 맞춤법, 띄어쓰기, 문법 오류만 수정하고, 원문의 스타일과 어휘 선택은 최대한 유지하세요."
      );
      break;
    case "enhanced":
      instructions.push(
        "적극적인 교정을 수행하세요. 기본적인 맞춤법, 띄어쓰기, 문법 오류 수정은 물론, 더 명확하고 세련된 표현으로 개선하세요. 문장 구조를 더 읽기 쉽게 재구성하고, 적절한 어휘로 대체하며, 논리적 흐름을 개선하세요. 불필요한 반복은 제거하고, 전문적이고 세련된 문체로 변환해주세요."
      );
      break;
    default:
      instructions.push(
        "균형 잡힌 교정을 수행하세요. 맞춤법, 띄어쓰기, 문법 오류를 수정하고 필요한 경우 문장을 개선하되, 원문의 의미와 의도는 최대한 유지하세요."
      );
  }

  // 격식 수준 지시문
  switch (formality) {
    case "formal":
      instructions.push("공식적이고 격식 있는 문체를 사용하세요.");
      break;
    case "informal":
      instructions.push("친근하고 자연스러운 문체를 사용하세요.");
      break;
  }

  // 간결성 지시문
  switch (conciseness) {
    case "concise":
      instructions.push("간결하고 명확한 문체로 작성하세요.");
      break;
    case "detailed":
      instructions.push("풍부하고 상세한 표현을 사용하세요.");
      break;
  }

  // 사용자 정의 설정 처리
  if (customSettings && Object.keys(customSettings).length > 0) {
    for (const [key, value] of Object.entries(customSettings)) {
      if (key === "focusAreas" && Array.isArray(value) && value.length > 0) {
        const areas = value.join(", ");
        instructions.push(`특히 ${areas}에 중점을 두고 교정하세요.`);
      } else if (key === "preserveStyle" && typeof value === "boolean") {
        if (value) {
          instructions.push("원문의 스타일과 어조를 최대한 유지하세요.");
        } else {
          instructions.push("필요하다면 스타일을 자유롭게 개선하세요.");
        }
      } else if (typeof value === "string") {
        instructions.push(`${key}: ${value}`);
      }
    }
  }

  return instructions.join(" ");
}

/**
 * 스타일 가이드를 프롬프트용 텍스트로 포맷팅합니다.
 * @param {Array} styleGuides - 스타일 가이드 배열
 * @param {Object} options - 포맷팅 옵션
 * @returns {string} - 포맷팅된 스타일 가이드 텍스트
 */
function formatStyleGuides(styleGuides, options = {}) {
  if (!styleGuides || styleGuides.length === 0) {
    return "참조할 스타일 가이드가 없습니다.";
  }

  const {
    maxLength = 2000,
    detailedFormat = false,
    includeExamples = true,
  } = options;

  // 스타일 가이드 텍스트 생성
  const guideTexts = styleGuides.map((guide) => {
    if (detailedFormat) {
      let text = `[${guide.category || "일반"}] ${guide.section || ""}:\n${
        guide.content || ""
      }`;

      if (includeExamples && guide.examples && guide.examples.length > 0) {
        text += "\n예시:";
        guide.examples.forEach((example) => {
          text += `\n- ${example}`;
        });
      }

      return text;
    } else {
      return `[${guide.category || "일반"}] ${guide.content || ""}`;
    }
  });

  // 텍스트 결합
  let result = guideTexts.join("\n\n");

  // 길이 제한
  if (result.length > maxLength) {
    result = result.substring(0, maxLength) + "...";
  }

  return result;
}

/**
 * 날리지 규칙을 포함한 향상된 프롬프트를 생성합니다.
 * @param {string} originalText - 원문 텍스트
 * @param {string} template - 프롬프트 템플릿
 * @param {Object} options - 옵션
 * @returns {Promise<string>} - 향상된 프롬프트
 */
async function buildEnhancedPrompt(originalText, template, options = {}) {
  try {
    const {
      styleGuides = [],
      preferences = {},
      includeKnowledge = true,
      maxKnowledgeRules = 7,
      knowledgeType = null,
    } = options;

    // 변수 객체 초기화
    const variables = {
      ORIGINAL_TEXT: originalText,
    };

    // 관련 날리지 규칙 검색
    let knowledgeRules = [];
    if (includeKnowledge) {
      knowledgeRules = await knowledgeService.findRelevantRules(originalText, {
        limit: maxKnowledgeRules,
        type: knowledgeType,
        minScore: 0.65,
      });

      if (knowledgeRules.length > 0) {
        logger.info(`${knowledgeRules.length}개의 관련 날리지 규칙 찾음`);

        // 날리지 규칙 포맷팅
        const knowledgeText = knowledgeService.formatRulesForPrompt(
          knowledgeRules,
          {
            maxLength: 2000,
            includeExamples: true,
            formatType: "detailed",
          }
        );

        variables.KNOWLEDGE_RULES = knowledgeText;
      } else {
        variables.KNOWLEDGE_RULES = "참조할 날리지 규칙이 없습니다.";
      }
    }

    // 스타일 가이드 포맷팅
    if (styleGuides && styleGuides.length > 0) {
      variables.STYLE_GUIDES = formatStyleGuides(styleGuides, {
        maxLength: 1500,
        detailedFormat: true,
      });
    } else {
      variables.STYLE_GUIDES = "참조할 스타일 가이드가 없습니다.";
    }

    // 사용자 선호도 텍스트 생성
    if (Object.keys(preferences).length > 0) {
      variables.USER_PREFERENCES = generatePreferencesText(preferences);
    }

    // 프롬프트 생성
    return buildPrompt(template, variables);
  } catch (error) {
    logger.error(`향상된 프롬프트 생성 오류: ${error.message}`);

    // 오류 발생 시 기본 프롬프트 생성
    return buildPrompt(template, {
      ORIGINAL_TEXT: originalText,
      STYLE_GUIDES: "스타일 가이드를 불러오는 중 오류가 발생했습니다.",
    });
  }
}

module.exports = {
  buildPrompt,
  formatStyleGuideList,
  generatePreferencesText,
  formatStyleGuides,
  buildEnhancedPrompt,
};
