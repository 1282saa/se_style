/**
 * src/services/llm/responseParser.js
 * Claude API 응답에서 JSON을 추출하고 파싱하는 기능을 제공합니다.
 */

const logger = require("../../utils/logger");

/**
 * Claude API 응답에서 JSON을 추출하는 다양한 전략 시도
 * @param {string} text - 파싱할 Claude API 응답 텍스트
 * @param {object} options - 추가 옵션
 * @returns {object|null} - 파싱된 JSON 객체 또는 실패 시 null
 */
function parseClaudeResponse(text, options = {}) {
  if (!text || typeof text !== "string") {
    logger.warn("파싱할 텍스트가 비어 있거나 문자열이 아닙니다");
    return null;
  }

  // 1. JSON 코드 블록 추출 시도 (가장 정확한 방법)
  const jsonResult = extractJsonFromCodeBlock(text);
  if (jsonResult) {
    logger.debug("JSON 코드 블록에서 유효한 JSON 추출됨");
    return jsonResult;
  }

  // 2. 중괄호 영역 추출 시도
  const bracesResult = extractJsonFromBraces(text);
  if (bracesResult) {
    logger.debug("중괄호 영역에서 유효한 JSON 추출됨");
    return bracesResult;
  }

  // 3. 줄 단위 JSON 추출 시도
  const lineResult = extractJsonFromLine(text);
  if (lineResult) {
    logger.debug("줄 단위 분석에서 유효한 JSON 추출됨");
    return lineResult;
  }

  // 4. 마지막 수단: 응답에서 키-값 구조 추출 시도
  if (options.extractKeyValues !== false) {
    const keyValueResult = extractKeyValues(text);
    if (keyValueResult && Object.keys(keyValueResult).length > 0) {
      logger.debug("키-값 구조에서 객체 생성됨");
      return keyValueResult;
    }
  }

  // 모든 방법 실패
  logger.warn("모든 JSON 파싱 방법 실패, 결과 없음");
  return null;
}

/**
 * JSON 코드 블록에서 JSON 추출
 * @param {string} text - 파싱할 텍스트
 * @returns {object|null} - 파싱된 JSON 또는 null
 */
function extractJsonFromCodeBlock(text) {
  try {
    // 코드 블록 패턴 - 다양한 형식 지원
    const patterns = [
      /```json\n([\s\S]*?)```/gi, // ```json\n{ ... }```
      /```\s*json\s*\n([\s\S]*?)```/gi, // 공백 허용
      /```\n([\s\S]*?)```/gi, // ```\n{ ... }```
      /```([\s\S]*?)```/gi, // ```{ ... }```
      /`\s*json\s*\n([\s\S]*?)`/gi, // `json\n{ ... }`
    ];

    for (const pattern of patterns) {
      const matches = [...text.matchAll(pattern)];

      for (const match of matches) {
        const jsonContent = match[1].trim();

        // JSON 객체처럼 보이는지 기본 확인
        if (jsonContent.startsWith("{") && jsonContent.endsWith("}")) {
          try {
            const cleanedJson = cleanJsonString(jsonContent);
            return JSON.parse(cleanedJson);
          } catch (err) {
            logger.debug(
              `JSON 코드 블록 파싱 실패 (패턴: ${pattern}): ${err.message}`
            );
            // 다음 패턴으로 계속
          }
        }
      }
    }

    return null;
  } catch (error) {
    logger.debug(`JSON 코드 블록 추출 중 오류: ${error.message}`);
    return null;
  }
}

/**
 * 중괄호로 둘러싸인 영역에서 JSON 추출
 * @param {string} text - 파싱할 텍스트
 * @returns {object|null} - 파싱된 JSON 또는 null
 */
function extractJsonFromBraces(text) {
  try {
    let start = text.indexOf("{");
    if (start === -1) return null;

    // 중첩된 중괄호 처리를 위한 카운터
    let openBraces = 0;
    let end = -1;

    for (let i = start; i < text.length; i++) {
      if (text[i] === "{") {
        openBraces++;
      } else if (text[i] === "}") {
        openBraces--;
        if (openBraces === 0) {
          end = i;
          break;
        }
      }
    }

    if (end === -1) return null;

    const jsonCandidate = text.substring(start, end + 1);

    try {
      const cleanedJson = cleanJsonString(jsonCandidate);
      return JSON.parse(cleanedJson);
    } catch (err) {
      logger.debug(`중괄호 영역 JSON 파싱 실패: ${err.message}`);

      // 다른 중괄호 쌍 시도
      if (text.indexOf("{", start + 1) !== -1) {
        const remainingText = text.substring(start + 1);
        return extractJsonFromBraces(remainingText);
      }

      return null;
    }
  } catch (error) {
    logger.debug(`중괄호 추출 중 오류: ${error.message}`);
    return null;
  }
}

/**
 * 줄 단위 분석으로 JSON 추출
 * @param {string} text - 파싱할 텍스트
 * @returns {object|null} - 파싱된 JSON 또는 null
 */
function extractJsonFromLine(text) {
  try {
    // 줄 단위로 분할
    const lines = text.split("\n");

    // 각 줄을 확인하여 JSON으로 보이는 줄 찾기
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
        try {
          const cleanedJson = cleanJsonString(trimmed);
          return JSON.parse(cleanedJson);
        } catch (err) {
          // 이 줄은 유효한 JSON이 아님, 계속 진행
          logger.debug(`줄 JSON 파싱 실패: ${err.message}`);
        }
      }
    }

    // 여러 줄에 걸친 JSON 찾기
    let jsonCandidate = "";
    let inJson = false;
    let bracesCount = 0;

    for (const line of lines) {
      const trimmed = line.trim();

      if (!inJson && trimmed.startsWith("{")) {
        inJson = true;
        bracesCount = 1;
        jsonCandidate = trimmed;
      } else if (inJson) {
        jsonCandidate += "\n" + trimmed;

        // 중괄호 카운팅
        for (const char of trimmed) {
          if (char === "{") bracesCount++;
          else if (char === "}") bracesCount--;
        }

        // JSON 종료 확인
        if (bracesCount === 0) {
          try {
            const cleanedJson = cleanJsonString(jsonCandidate);
            return JSON.parse(cleanedJson);
          } catch (err) {
            // 이 후보는 유효한 JSON이 아님, 다음 후보 탐색
            inJson = false;
            jsonCandidate = "";
            logger.debug(`다중 줄 JSON 파싱 실패: ${err.message}`);
          }
        }
      }
    }

    return null;
  } catch (error) {
    logger.debug(`줄 단위 분석 중 오류: ${error.message}`);
    return null;
  }
}

/**
 * 텍스트에서 키-값 구조 추출
 * @param {string} text - 파싱할 텍스트
 * @returns {object|null} - 생성된 객체 또는 null
 */
function extractKeyValues(text) {
  try {
    const result = {};

    // 1. "키: 값" 패턴 찾기
    const keyValuePattern =
      /([A-Za-z0-9가-힣_]+)\s*:\s*(.+?)(?=\n[A-Za-z0-9가-힣_]+\s*:|$)/gs;
    const matches = [...text.matchAll(keyValuePattern)];

    if (matches.length > 0) {
      for (const match of matches) {
        const key = match[1].trim();
        const value = match[2].trim();
        if (key && value) {
          // 불필요한 인용 부호 제거
          result[key] = value.replace(/^["']|["']$/g, "");
        }
      }

      return result;
    }

    // 2. 다른 패턴 시도 (예: "- 키: 값")
    const bulletKeyValuePattern =
      /-\s*([A-Za-z0-9가-힣_]+)\s*:\s*(.+?)(?=\n-|$)/gs;
    const bulletMatches = [...text.matchAll(bulletKeyValuePattern)];

    if (bulletMatches.length > 0) {
      for (const match of bulletMatches) {
        const key = match[1].trim();
        const value = match[2].trim();
        if (key && value) {
          result[key] = value.replace(/^["']|["']$/g, "");
        }
      }

      return result;
    }

    return null;
  } catch (error) {
    logger.debug(`키-값 추출 중 오류: ${error.message}`);
    return null;
  }
}

/**
 * JSON 문자열 정리
 * @param {string} jsonStr - 정리할 JSON 문자열
 * @returns {string} - 정리된 JSON 문자열
 */
function cleanJsonString(jsonStr) {
  if (!jsonStr) return "";

  return jsonStr
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, "") // 제어 문자 제거
    .replace(/\\"/g, '"') // 이스케이프된 따옴표 정리
    .replace(/\\n/g, " ") // 이스케이프된 줄바꿈을 공백으로
    .replace(/\\/g, "\\\\") // 단일 백슬래시를 이스케이프
    .replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":') // 따옴표 없는 키에 따옴표 추가
    .replace(/,\s*}/g, "}") // 마지막 쉼표 제거
    .replace(/,\s*,/g, ",") // 연속된 쉼표 제거
    .trim();
}

/**
 * 교정 결과 객체를 생성하는 보조 함수
 * @param {string} text - Claude API 응답
 * @param {string} originalText - 원본 텍스트
 * @returns {object} - 교정 결과 객체
 */
function createCorrectionResult(text, originalText) {
  const parsedJson = parseClaudeResponse(text);

  if (parsedJson) {
    // JSON 구조에서 교정 결과 추출
    const correctedText =
      parsedJson.correctedText ||
      parsedJson.corrected_text ||
      parsedJson.text ||
      parsedJson.result ||
      text;

    const corrections =
      parsedJson.corrections || parsedJson.changes || parsedJson.edits || [];

    return {
      correctedText,
      corrections,
      parsed: true,
    };
  }

  // JSON 파싱 실패 시 전체 텍스트를 교정 결과로 사용
  logger.warn("JSON 파싱 실패, 전체 텍스트를 교정 결과로 사용");
  return {
    correctedText: text,
    corrections: [],
    parsed: false,
  };
}

module.exports = {
  parseClaudeResponse,
  extractJsonFromCodeBlock,
  extractJsonFromBraces,
  extractJsonFromLine,
  extractKeyValues,
  cleanJsonString,
  createCorrectionResult,
};
