/**
 * src/utils/textAnalysis.js
 * 텍스트 분석 및 비교 유틸리티
 */
const logger = require("./logger");

/**
 * 원문과 교정된 텍스트 간의 변경 사항을 추출합니다
 * @param {string} originalText - 원문 텍스트
 * @param {string} correctedText - 교정된 텍스트
 * @returns {Array} - 변경 사항 배열
 */
function extractChanges(originalText, correctedText) {
  try {
    if (!originalText || !correctedText) {
      return [];
    }

    // 단순 변경 감지 (기본 구현)
    const changes = [];

    // 텍스트를 문장 단위로 분리
    const originalSentences = splitIntoSentences(originalText);
    const correctedSentences = splitIntoSentences(correctedText);

    // 문장별 비교
    const minLength = Math.min(
      originalSentences.length,
      correctedSentences.length
    );

    for (let i = 0; i < minLength; i++) {
      const original = originalSentences[i];
      const corrected = correctedSentences[i];

      if (original !== corrected) {
        // 차이점 발견
        changes.push({
          original: original,
          suggestion: corrected,
          type: determineChangeType(original, corrected),
          explanation: "",
          confidence: 0.9,
          priority: 3,
        });
      }
    }

    // 문장 수 차이가 있는 경우 처리
    if (originalSentences.length > correctedSentences.length) {
      // 원문에 있는 문장이 삭제됨
      for (let i = minLength; i < originalSentences.length; i++) {
        changes.push({
          original: originalSentences[i],
          suggestion: "",
          type: "deletion",
          explanation: "불필요한 문장이 제거되었습니다",
          confidence: 0.8,
          priority: 2,
        });
      }
    } else if (originalSentences.length < correctedSentences.length) {
      // 새 문장이 추가됨
      for (let i = minLength; i < correctedSentences.length; i++) {
        changes.push({
          original: "",
          suggestion: correctedSentences[i],
          type: "addition",
          explanation: "새로운 문장이 추가되었습니다",
          confidence: 0.8,
          priority: 2,
        });
      }
    }

    return changes;
  } catch (error) {
    logger.error(`변경 사항 추출 오류: ${error.message}`);
    return [];
  }
}

/**
 * 변경 유형을 결정합니다
 * @param {string} original - 원문 텍스트
 * @param {string} corrected - 교정된 텍스트
 * @returns {string} - 변경 유형
 */
function determineChangeType(original, corrected) {
  if (!original) return "addition";
  if (!corrected) return "deletion";

  // 띄어쓰기 변경인지 확인
  if (original.replace(/\s+/g, "") === corrected.replace(/\s+/g, "")) {
    return "spacing";
  }

  // 맞춤법 오류인지 확인 (간단한 휴리스틱)
  if (Math.abs(original.length - corrected.length) <= 2) {
    return "spelling";
  }

  // 문법 오류인지 확인 (조사, 어미 등)
  const grammarPatterns = /은|는|이|가|을|를|에|의|와|과|로|으로/g;
  if (
    (original.match(grammarPatterns) && corrected.match(grammarPatterns)) ||
    Math.abs(original.length - corrected.length) <= 5
  ) {
    return "grammar";
  }

  // 문장 구조 변경
  if (Math.abs(original.length - corrected.length) > 5) {
    return "structure";
  }

  // 기본 값
  return "style";
}

/**
 * 텍스트를 문장으로 분리합니다
 * @param {string} text - 분리할 텍스트
 * @returns {Array<string>} - 문장 배열
 */
function splitIntoSentences(text) {
  if (!text) return [];

  // 한국어 문장 구분 패턴: 마침표, 물음표, 느낌표로 끝나는 경우
  return text
    .replace(/([.!?])\s+/g, "$1|") // 문장 구분자 뒤에 파이프 추가
    .split("|") // 파이프로 분리
    .filter((sentence) => sentence.trim().length > 0) // 빈 문장 제거
    .map((sentence) => sentence.trim()); // 양쪽 공백 제거
}

/**
 * 원문과 교정 텍스트 간의 통계를 계산합니다
 * @param {string} originalText - 원문 텍스트
 * @param {string} correctedText - 교정된 텍스트
 * @returns {Object} - 통계 객체
 */
function calculateStats(originalText, correctedText) {
  try {
    if (!originalText || !correctedText) {
      return {
        originalLength: originalText ? originalText.length : 0,
        correctedLength: correctedText ? correctedText.length : 0,
        charDiff: 0,
        sentenceCount: 0,
        changeRatio: 0,
        status: "empty",
      };
    }

    const originalSentences = splitIntoSentences(originalText);
    const correctedSentences = splitIntoSentences(correctedText);

    // 변경된 문장 수 계산
    let changedSentences = 0;
    const minLength = Math.min(
      originalSentences.length,
      correctedSentences.length
    );

    for (let i = 0; i < minLength; i++) {
      if (originalSentences[i] !== correctedSentences[i]) {
        changedSentences++;
      }
    }

    // 추가되거나 삭제된 문장 수
    const addedOrDeletedSentences = Math.abs(
      originalSentences.length - correctedSentences.length
    );

    // 총 변경된 문장 수
    changedSentences += addedOrDeletedSentences;

    // 변경 비율 계산
    const sentenceCount = Math.max(
      originalSentences.length,
      correctedSentences.length
    );
    const changeRatio =
      sentenceCount > 0 ? changedSentences / sentenceCount : 0;

    // 결과 반환
    return {
      originalLength: originalText.length,
      correctedLength: correctedText.length,
      charDiff: correctedText.length - originalText.length,
      sentenceCount,
      changedSentences,
      changeRatio,
      status: determineChangeStatus(changeRatio),
    };
  } catch (error) {
    logger.error(`통계 계산 오류: ${error.message}`);
    return {
      originalLength: originalText ? originalText.length : 0,
      correctedLength: correctedText ? correctedText.length : 0,
      charDiff: 0,
      sentenceCount: 0,
      changeRatio: 0,
      status: "error",
    };
  }
}

/**
 * 변경 상태를 결정합니다
 * @param {number} changeRatio - 변경 비율
 * @returns {string} - 변경 상태
 */
function determineChangeStatus(changeRatio) {
  if (changeRatio === 0) {
    return "unchanged";
  } else if (changeRatio < 0.1) {
    return "minor";
  } else if (changeRatio < 0.3) {
    return "moderate";
  } else if (changeRatio < 0.7) {
    return "major";
  } else {
    return "extensive";
  }
}

module.exports = {
  extractChanges,
  calculateStats,
  splitIntoSentences,
};
