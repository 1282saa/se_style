/**
 * 토큰 유틸리티
 * 텍스트의 토큰 수를 계산하고 관리하는 함수들을 제공합니다.
 * @module utils/tokens
 */

// 간단한 토큰 카운터 (대략적인 추정)
// 실제 Anthropic의 토큰 계산과 다를 수 있으나 대략적인 추정에 사용
function estimateTokenCount(text) {
  if (!text) return 0;

  // 공백으로 분할하여 단어 수 계산 (영어 기준)
  const wordCount = text.trim().split(/\s+/).length;

  // 영어는 대략 0.75 words/token, 한국어는 더 복잡함
  // 한국어는 문자 기준으로 추정 (대략 2자당 1토큰으로 가정)
  const koreanChars = (text.match(/[가-힣]/g) || []).length;
  const nonKoreanChars = text.length - koreanChars;

  // 한국어 문자는 대략 2자당 1토큰, 나머지는 4자당 1토큰
  const koreanTokens = koreanChars / 2;
  const nonKoreanTokens = nonKoreanChars / 4;

  // 단어 수 기반 추정값과 문자 수 기반 추정값 중 큰 값 사용
  return Math.max(wordCount * 0.75, koreanTokens + nonKoreanTokens);
}

/**
 * 텍스트의 토큰 수를 대략적으로 추정합니다.
 * 영어 기준으로는 대략 단어 4개에 토큰 3개 정도로 계산합니다.
 * 한글은 더 많은 토큰을 사용하므로 글자 당 0.5 토큰으로 대략 추정합니다.
 *
 * @param {string} text 토큰 수를 추정할 텍스트
 * @returns {number} 추정 토큰 수
 */
function estimateTokens(text) {
  if (!text) return 0;

  // 한글과 영어가 섞인 텍스트 처리를 위한 간단한 추정
  // 한글은 글자당 약 0.5 토큰, 영어는 단어당 약 0.75 토큰으로 추정

  // 한글 문자 수 계산 (정규식으로 한글 유니코드 범위 확인)
  const koreanChars = (text.match(/[\uAC00-\uD7AF]/g) || []).length;

  // 영어 단어 수 계산
  const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;

  // 숫자 및 기타 문자 수
  const otherChars =
    text.length -
    koreanChars -
    (text.match(/[a-zA-Z]+/g) || []).join("").length;

  // 토큰 수 추정
  const estimatedTokens = Math.ceil(
    koreanChars * 0.5 + // 한글 글자당 약 0.5 토큰
      englishWords * 0.75 + // 영어 단어당 약 0.75 토큰
      otherChars * 0.25 // 기타 문자당 약 0.25 토큰
  );

  return Math.max(1, estimatedTokens); // 최소 1 토큰
}

// 메시지 배열의 총 토큰 수 추정
function estimateMessagesTokenCount(messages) {
  if (!messages || !Array.isArray(messages)) return 0;

  // 메시지 구조 오버헤드 토큰 (각 메시지마다 약 4토큰)
  const overhead = messages.length * 4;

  // 각 메시지 콘텐츠의 토큰 수 합계
  const contentTokens = messages.reduce((sum, msg) => {
    return sum + estimateTokenCount(msg.content || "");
  }, 0);

  return overhead + contentTokens;
}

// 텍스트가 최대 토큰 수를 초과하는지 확인
function exceedsMaxTokens(text, maxTokens = 8000) {
  return estimateTokenCount(text) > maxTokens;
}

// 최대 토큰 수에 맞게 텍스트 잘라내기
function truncateToMaxTokens(text, maxTokens = 8000) {
  if (!text) return "";
  if (!exceedsMaxTokens(text, maxTokens)) return text;

  // 간단한 처리: 문자 길이로 비례해서 자르기
  // (정확한 방법은 아니지만 대략적인 추정)
  const ratio = maxTokens / estimateTokenCount(text);
  const charLimit = Math.floor(text.length * ratio * 0.9); // 안전 마진 10%

  return text.slice(0, charLimit) + "...";
}

module.exports = {
  estimateTokenCount,
  estimateMessagesTokenCount,
  exceedsMaxTokens,
  truncateToMaxTokens,
  estimateTokens,
};
