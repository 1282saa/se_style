/**
 * 벡터 검색 서비스
 * - 스타일북 규칙을 벡터로 변환하고 검색하는 기능 제공
 */

const { OpenAI } = require("openai");
const Styleguide = require("../../models/styleguide.model");
const logger = require("../../utils/logger");

// OpenAI 클라이언트 초기화
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * 텍스트를 벡터로 변환
 * @param {string} text - 임베딩할 텍스트
 * @returns {Promise<number[]>} - 벡터 배열
 */
async function createEmbedding(text) {
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: text,
    });

    return response.data[0].embedding;
  } catch (error) {
    logger.error("임베딩 생성 오류:", error);
    throw new Error("텍스트 임베딩 생성 중 오류가 발생했습니다.");
  }
}

/**
 * 문장 단위로 텍스트 분할
 * @param {string} text
 * @returns {string[]} 문장 배열
 */
function splitIntoSentences(text) {
  return text
    .replace(/([.!?])\s*(?=[A-Z])/g, "$1|")
    .split("|")
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}

/**
 * 기사 관련 스타일북 규칙 검색
 * @param {string} articleText - 기사 텍스트
 * @param {Object} options - 검색 옵션
 * @param {number} options.limit - 반환할 최대 규칙 수 (기본값: 5)
 * @param {number} options.threshold - 최소 유사도 점수 (기본값: 0.75)
 * @returns {Promise<Array>} - 관련 스타일북 규칙 배열
 */
async function findRelevantStyleguides(articleText, options = {}) {
  const { limit = 10, threshold = 0.75 } = options;

  try {
    // 벡터 DB 유형에 따라 검색 방식 결정
    const vectorDbType = process.env.VECTOR_DB_TYPE || "pinecone";

    if (vectorDbType === "mongodb") {
      // MongoDB Atlas Vector Search 사용
      // 1. 기사 텍스트 임베딩 생성
      const articleEmbedding = await createEmbedding(articleText);

      // 2. 벡터 검색 수행
      return await Styleguide.vectorSearch(articleEmbedding, limit);
    } else {
      // Pinecone 또는 다른 외부 벡터 DB 사용 시 구현 필요
      // (여기서는 간단한 키워드 기반 검색으로 대체)
      logger.warn(
        "Pinecone 벡터 검색이 아직 구현되지 않았습니다. 키워드 기반 검색을 사용합니다."
      );

      // 간단한 키워드 매칭 검색 (임시)
      const sentences = splitIntoSentences(articleText);
      const keywords = sentences
        .flatMap((sentence) => sentence.split(/\s+/))
        .filter((word) => word.length > 1)
        .slice(0, 20);

      const query = {
        $or: [
          { tags: { $in: keywords } },
          { content: { $regex: keywords.join("|"), $options: "i" } },
        ],
      };

      return await Styleguide.find(query).limit(limit);
    }
  } catch (error) {
    logger.error("스타일북 검색 오류:", error);
    throw new Error("관련 스타일북 규칙 검색 중 오류가 발생했습니다.");
  }
}

/**
 * 스타일북을 벡터 DB에 인덱싱
 * @param {Object} styleguide - 저장할 스타일북 객체
 * @returns {Promise<Object>} - 임베딩이 추가된 스타일북 객체
 */
async function indexStyleguide(styleguide) {
  try {
    // 임베딩 생성
    const textToEmbed = `${styleguide.section}: ${styleguide.content}`;
    const embedding = await createEmbedding(textToEmbed);

    // 임베딩 저장
    styleguide.vector = embedding;
    return styleguide;
  } catch (error) {
    logger.error("스타일북 인덱싱 오류:", error);
    throw new Error("스타일북 벡터 인덱싱 중 오류가 발생했습니다.");
  }
}

module.exports = {
  createEmbedding,
  findRelevantStyleguides,
  indexStyleguide,
  splitIntoSentences,
};
