/**
 * 벡터 관련 유틸리티 함수
 * @module utils/vectorUtils
 */

/**
 * 두 벡터 간의 코사인 유사도를 계산합니다.
 * @param {number[]} vecA - 첫 번째 벡터
 * @param {number[]} vecB - 두 번째 벡터
 * @returns {number} 코사인 유사도 값 (-1 ~ 1)
 * @throws {Error} 벡터 길이가 다르거나 유효하지 않은 경우
 */
function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length || vecA.length === 0) {
    throw new Error("유효하지 않거나 길이가 다른 벡터입니다.");
  }

  let dotProduct = 0.0;
  let normA = 0.0;
  let normB = 0.0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  const magnitudeA = Math.sqrt(normA);
  const magnitudeB = Math.sqrt(normB);

  if (magnitudeA === 0 || magnitudeB === 0) {
    // 벡터 중 하나의 크기가 0이면 유사도를 0으로 처리 (나눗셈 오류 방지)
    return 0;
  }

  const similarity = dotProduct / (magnitudeA * magnitudeB);

  // 부동 소수점 오류로 인해 유사도가 1을 약간 넘거나 -1보다 약간 작아지는 경우 보정
  return Math.max(-1, Math.min(1, similarity));
}

module.exports = { cosineSimilarity };
