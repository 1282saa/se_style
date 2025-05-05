/**
 * MongoDB에 저장된 벡터 임베딩을 사용하여 유사도 검색을 수행하는 서비스
 * @module services/rag/similaritySearchService
 */

const embeddingProvider = require("./embeddingProvider");
const Styleguide = require("../../models/styleguide.model");
const { cosineSimilarity } = require("../../utils/vectorUtils");
const logger = require("../../utils/logger");

/**
 * 주어진 텍스트와 가장 유사한 스타일 가이드 항목을 MongoDB에서 검색합니다.
 *
 * @param {string} queryText - 검색할 텍스트
 * @param {number} [limit=5] - 반환할 최대 결과 수
 * @param {object} [filter={}] - MongoDB 조회 시 적용할 추가 필터 (예: { category: '맞춤법' })
 * @returns {Promise<Array<{guide: object, score: number}>>} - 유사도 점수와 함께 정렬된 스타일 가이드 목록
 */
async function searchSimilarStyleguides(queryText, limit = 5, filter = {}) {
  try {
    // 1. 검색어 임베딩 생성
    logger.debug(`유사도 검색 시작: "${queryText.substring(0, 50)}..."`);
    const queryEmbedding = await embeddingProvider.createEmbedding(queryText);

    if (!queryEmbedding || queryEmbedding.length === 0) {
      throw new Error("검색어에 대한 임베딩 생성에 실패했습니다.");
    }
    logger.debug(`검색어 임베딩 생성 완료 (차원: ${queryEmbedding.length})`);

    // 2. MongoDB에서 관련 문서 조회
    //    - 활성화된 가이드만 대상으로 함 (isActive: true)
    //    - 임베딩 필드가 존재하는 문서만 대상으로 함
    //    - 추가 필터 조건 적용
    //    - 필요한 필드만 선택 (성능 고려)
    const mongoFilter = {
      ...filter, // 외부에서 전달된 필터 적용
      isActive: true, // 활성화된 가이드만 검색
      embedding: { $exists: true, $ne: null, $not: { $size: 0 } }, // 유효한 임베딩 필터
    };
    logger.debug("MongoDB 조회 필터:", mongoFilter);

    const candidateGuides = await Styleguide.find(mongoFilter)
      .select("_id ruleId section category content embedding") // 필요한 최소 필드 + 임베딩
      .lean(); // Mongoose 객체 대신 순수 JavaScript 객체로 가져옴 (성능 향상)

    logger.info(`유사도 비교 대상 후보 ${candidateGuides.length}개 조회 완료`);

    if (candidateGuides.length === 0) {
      return []; // 후보가 없으면 빈 배열 반환
    }

    // 3. 코사인 유사도 계산
    const resultsWithScores = candidateGuides.map((guide) => {
      let score = 0;
      try {
        score = cosineSimilarity(queryEmbedding, guide.embedding);
      } catch (error) {
        logger.warn(
          `유사도 계산 오류 (RuleID: ${guide.ruleId}): ${error.message}. 점수 0으로 처리.`
        );
      }
      return {
        guide: {
          // 필요한 정보만 포함하여 반환 객체 구성
          _id: guide._id,
          ruleId: guide.ruleId,
          section: guide.section,
          category: guide.category,
          content: guide.content,
          // embedding 필드는 결과에서 제외
        },
        score: score,
      };
    });

    // 4. 유사도 점수 기준으로 내림차순 정렬
    resultsWithScores.sort((a, b) => b.score - a.score);

    // 5. 상위 limit 개수만큼 결과 반환
    const finalResults = resultsWithScores.slice(0, limit);
    logger.debug("유사도 검색 결과 (상위 5개):");
    finalResults.forEach((r) =>
      logger.debug(
        `  - [${r.score.toFixed(4)}] ${r.guide.ruleId}: ${r.guide.section}`
      )
    );

    return finalResults;
  } catch (error) {
    logger.error(`유사 스타일 가이드 검색 중 오류 발생: ${error.message}`, {
      stack: error.stack,
    });
    return []; // 오류 발생 시 빈 배열 반환
  }
}

module.exports = {
  searchSimilarStyleguides,
};
