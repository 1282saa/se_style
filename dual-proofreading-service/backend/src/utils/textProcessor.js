/**
 * 텍스트 처리 유틸리티
 * 텍스트 분석, 전처리, 비교 및 복잡성 평가를 위한 다양한 기능을 제공합니다.
 * @module utils/textProcessor
 */

const logger = require("./logger");

/**
 * 텍스트 처리를 위한 다양한 유틸리티 메소드를 제공하는 클래스
 */
class TextProcessor {
  /**
   * 텍스트를 문장 단위로 분할합니다.
   * @param {string} text - 분할할 텍스트
   * @returns {string[]} - 문장 배열
   */
  splitSentences(text) {
    if (!text) return [];

    try {
      // 한국어 문장 분리 규칙 (마침표, 느낌표, 물음표 + 공백으로 분리)
      const sentences = text
        .replace(/([.!?])\s+(?=[가-힣A-Za-z0-9])/g, "$1|") // 문장 구분자 + 공백 + 다음 문장 시작
        .replace(/([.!?])(?=[가-힣A-Za-z0-9])/g, "$1|") // 문장 구분자 + 다음 문장 시작 (공백 없는 경우)
        .split("|")
        .map((sentence) => sentence.trim())
        .filter((sentence) => sentence.length > 0);

      return sentences;
    } catch (error) {
      logger.error(`문장 분할 오류: ${error.message}`);
      // 오류 발생 시 전체 텍스트를 하나의 문장으로 반환
      return [text];
    }
  }

  /**
   * 텍스트에서 핵심 키워드를 추출합니다.
   * 간소화된 TF-IDF 기반 알고리즘을 사용합니다.
   * @param {string} text - 키워드를 추출할 텍스트
   * @param {number} [limit=10] - 최대 키워드 수
   * @returns {string[]} - 추출된 키워드 배열
   */
  extractKeywords(text, limit = 10) {
    if (!text) return [];

    try {
      // 한국어 불용어 목록
      const stopwords = [
        "은",
        "는",
        "이",
        "가",
        "을",
        "를",
        "에",
        "의",
        "과",
        "와",
        "으로",
        "로",
        "이다",
        "있다",
        "하다",
        "그",
        "그리고",
        "그러나",
        "또한",
        "그런데",
        "이렇게",
        "저렇게",
        "그것",
        "이것",
        "저것",
        "그래서",
        "따라서",
        "때문에",
      ];

      // 텍스트 정규화
      const normalizedText = text
        .replace(/[^\w\s가-힣]/g, " ") // 특수문자 제거
        .replace(/\s+/g, " ") // 여러 공백을 하나로 병합
        .trim()
        .toLowerCase();

      // 단어 분리
      const words = normalizedText.split(" ");

      // 불용어 및 짧은 단어 필터링
      const filteredWords = words.filter(
        (word) => word.length > 1 && !stopwords.includes(word)
      );

      // 단어 빈도 계산
      const wordCounts = {};
      filteredWords.forEach((word) => {
        wordCounts[word] = (wordCounts[word] || 0) + 1;
      });

      // 빈도 기준 정렬 및 상위 키워드 추출
      const sortedWords = Object.entries(wordCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([word]) => word);

      return sortedWords;
    } catch (error) {
      logger.error(`키워드 추출 오류: ${error.message}`);
      return [];
    }
  }

  /**
   * 원문과 교정본의 차이를 찾아 변경 사항을 반환합니다.
   * @param {string} original - 원본 텍스트
   * @param {string} corrected - 교정된 텍스트
   * @returns {Object[]} - 변경 사항 배열 (type, original, corrected, explanation 포함)
   */
  findChanges(original, corrected) {
    if (!original || !corrected) return [];

    try {
      // 원문과 교정본을 문장 단위로 분할
      const originalSentences = this.splitSentences(original);
      const correctedSentences = this.splitSentences(corrected);

      const changes = [];

      // 각 문장 비교
      for (
        let i = 0;
        i < Math.min(originalSentences.length, correctedSentences.length);
        i++
      ) {
        const origSentence = originalSentences[i];
        const corrSentence = correctedSentences[i];

        // 문장이 다른 경우에만 변경 사항으로 기록
        if (origSentence !== corrSentence) {
          // 변경 유형 추정
          const changeType = this.estimateChangeType(
            origSentence,
            corrSentence
          );

          changes.push({
            type: changeType,
            original: origSentence,
            corrected: corrSentence,
            explanation: this.generateExplanation(
              changeType,
              origSentence,
              corrSentence
            ),
          });
        }
      }

      // 추가되거나 삭제된 문장 처리
      this.handleExtraOrMissingSentences(
        changes,
        originalSentences,
        correctedSentences
      );

      return changes;
    } catch (error) {
      logger.error(`변경 사항 탐지 오류: ${error.message}`);
      return [];
    }
  }

  /**
   * 추가되거나 삭제된 문장을 처리합니다.
   * @private
   * @param {Object[]} changes - 변경 사항 배열
   * @param {string[]} originalSentences - 원본 문장 배열
   * @param {string[]} correctedSentences - 교정된 문장 배열
   */
  handleExtraOrMissingSentences(
    changes,
    originalSentences,
    correctedSentences
  ) {
    // 추가된 문장 처리
    if (originalSentences.length < correctedSentences.length) {
      for (
        let i = originalSentences.length;
        i < correctedSentences.length;
        i++
      ) {
        changes.push({
          type: "addition",
          original: "",
          corrected: correctedSentences[i],
          explanation: "문장이 추가되었습니다.",
        });
      }
    }
    // 삭제된 문장 처리
    else if (originalSentences.length > correctedSentences.length) {
      for (
        let i = correctedSentences.length;
        i < originalSentences.length;
        i++
      ) {
        changes.push({
          type: "deletion",
          original: originalSentences[i],
          corrected: "",
          explanation: "문장이 삭제되었습니다.",
        });
      }
    }
  }

  /**
   * 두 문장 간의 변경 유형을 추정합니다.
   * @param {string} original - 원본 문장
   * @param {string} corrected - 교정된 문장
   * @returns {string} - 변경 유형 (spacing, spelling, grammar, expansion, condensation, style)
   */
  estimateChangeType(original, corrected) {
    // 띄어쓰기만 수정된 경우
    if (original.replace(/\s+/g, "") === corrected.replace(/\s+/g, "")) {
      return "spacing";
    }

    // 맞춤법 오류(단어 1-2개만 변경된 경우)
    const originalWords = original.split(/\s+/);
    const correctedWords = corrected.split(/\s+/);

    let differentWords = 0;
    for (
      let i = 0;
      i < Math.min(originalWords.length, correctedWords.length);
      i++
    ) {
      if (originalWords[i] !== correctedWords[i]) {
        differentWords++;
      }
    }

    // 길이 차이 계산
    const lengthDiff = Math.abs(correctedWords.length - originalWords.length);

    // 변경 유형 판단
    if (differentWords + lengthDiff <= 2) {
      return "spelling";
    } else if (differentWords + lengthDiff <= 4) {
      return "grammar";
    } else if (original.length < corrected.length * 0.7) {
      return "expansion";
    } else if (corrected.length < original.length * 0.7) {
      return "condensation";
    } else {
      return "style";
    }
  }

  /**
   * 변경 유형에 따른 설명을 생성합니다.
   * @param {string} changeType - 변경 유형
   * @param {string} original - 원본 문장
   * @param {string} corrected - 교정된 문장
   * @returns {string} - 변경 사항 설명
   */
  generateExplanation(changeType, original, corrected) {
    switch (changeType) {
      case "spacing":
        return "띄어쓰기가 수정되었습니다.";
      case "spelling":
        return "맞춤법이 수정되었습니다.";
      case "grammar":
        return "문법적 오류가 수정되었습니다.";
      case "expansion":
        return "문장이 더 자세하게 확장되었습니다.";
      case "condensation":
        return "문장이 더 간결하게 축약되었습니다.";
      case "style":
        return "문장 표현이 개선되었습니다.";
      case "addition":
        return "새로운 문장이 추가되었습니다.";
      case "deletion":
        return "불필요한 문장이 제거되었습니다.";
      default:
        return "문장이 수정되었습니다.";
    }
  }

  /**
   * 텍스트의 복잡성을 분석합니다.
   * @param {string} text - 분석할 텍스트
   * @returns {Object} - 복잡성 분석 결과 (score, level, details)
   */
  analyzeComplexity(text) {
    if (!text) return { score: 0, level: "없음", details: {} };

    try {
      // 문장 분리
      const sentences = this.splitSentences(text);

      // 단어 수 계산
      const words = text.split(/\s+/).filter((word) => word.length > 0);

      // 평균 문장 길이
      const avgSentenceLength = words.length / Math.max(sentences.length, 1);

      // 평균 단어 길이
      const totalCharacters = words.reduce((sum, word) => sum + word.length, 0);
      const avgWordLength = totalCharacters / Math.max(words.length, 1);

      // 복잡한 단어 수 (4글자 이상)
      const complexWords = words.filter((word) => word.length >= 4);
      const complexWordRatio = complexWords.length / Math.max(words.length, 1);

      // 복잡성 점수 계산 (간단한 버전)
      const complexityScore =
        avgSentenceLength * 0.5 + avgWordLength * 0.3 + complexWordRatio * 0.2;

      // 복잡성 수준 결정
      let complexityLevel = this.getComplexityLevel(complexityScore);

      return {
        score: complexityScore,
        level: complexityLevel,
        details: {
          sentences: sentences.length,
          words: words.length,
          avgSentenceLength,
          avgWordLength,
          complexWords: complexWords.length,
          complexWordRatio,
        },
      };
    } catch (error) {
      logger.error(`텍스트 복잡성 분석 오류: ${error.message}`);
      return { score: 0, level: "오류", details: {} };
    }
  }

  /**
   * 복잡성 점수에 따른 수준을 결정합니다.
   * @private
   * @param {number} score - 복잡성 점수
   * @returns {string} - 복잡성 수준 설명
   */
  getComplexityLevel(score) {
    if (score < 5) {
      return "쉬움";
    } else if (score < 8) {
      return "보통";
    } else if (score < 12) {
      return "복잡함";
    } else {
      return "매우 복잡함";
    }
  }

  /**
   * 텍스트를 정규화합니다. (특수문자 처리, 공백 정리 등)
   * @param {string} text - 정규화할 텍스트
   * @returns {string} - 정규화된 텍스트
   */
  normalizeText(text) {
    if (!text) return "";

    try {
      // 연속된 공백을 하나로 통합
      let normalized = text.replace(/\s+/g, " ");

      // 문장 부호 정규화 (앞뒤 공백 조정)
      normalized = normalized
        .replace(/\s*([,.!?:;])\s*/g, "$1 ") // 문장 부호 뒤에 공백 하나
        .replace(/\s+([,.!?:;])/g, "$1") // 문장 부호 앞의 공백 제거
        .replace(/([,.!?:;])\s+/g, "$1 ") // 문장 부호 뒤에 공백 하나만 남김
        .replace(/\s*"([^"]*)"\s*/g, ' "$1" ') // 따옴표 앞뒤로 공백 하나
        .replace(/\s*'([^']*)'\s*/g, " '$1' ") // 작은따옴표 앞뒤로 공백 하나
        .replace(/\(\s+/g, "(") // 열린 괄호 뒤 공백 제거
        .replace(/\s+\)/g, ")") // 닫힌 괄호 앞 공백 제거
        .replace(/\s+\.{3}/g, "...") // 말줄임표 앞 공백 제거
        .replace(/\.{3}\s+/g, "... ") // 말줄임표 뒤 공백 하나
        .replace(/\s{2,}/g, " "); // 다시 한번 모든 연속된 공백 통합

      // 앞뒤 공백 제거
      normalized = normalized.trim();

      return normalized;
    } catch (error) {
      logger.error(`텍스트 정규화 오류: ${error.message}`);
      return text; // 오류 시 원본 반환
    }
  }

  /**
   * 텍스트 내용을 안전하게 줄입니다. (문장 단위로 자름)
   * @param {string} text - 원본 텍스트
   * @param {number} [maxLength=1000] - 최대 길이
   * @returns {string} - 축약된 텍스트
   */
  truncateText(text, maxLength = 1000) {
    if (!text || text.length <= maxLength) return text;

    try {
      // 문장 단위로 분할
      const sentences = this.splitSentences(text);

      let result = "";
      for (const sentence of sentences) {
        if ((result + sentence).length <= maxLength - 3) {
          // "..." 길이 고려
          result += sentence + " ";
        } else {
          break;
        }
      }

      return result.trim() + "...";
    } catch (error) {
      logger.error(`텍스트 축약 오류: ${error.message}`);
      // 오류 발생 시 단순 자르기
      return text.substring(0, maxLength - 3) + "...";
    }
  }
}

module.exports = new TextProcessor();
