// src/services/vectorSearch.js
//--------------------------------------------------
/**
 * Styleguide 벡터 검색 서비스
 *  - Anthropic 임베딩(getEmbedding)
 *  - MongoDB Atlas VectorSearch 또는 Pinecone 지원
 *  - Redis TTL 캐싱으로 비용 및 지연 최소화
 */

const { getEmbedding } = require("./embeddingProvider");
const { mongoSearch } = require("../adapters/vector/mongodb");
const { pineconeSearch } = require("../adapters/vector/pinecone");
const redis = require("../../utils/redisClient");
const logger = require("../../utils/logger");

const VECTOR_DB = process.env.VECTOR_DB_TYPE || "mongodb"; // mongodb | pinecone
const CACHE_TTL = Number(process.env.VECTOR_CACHE_TTL) || 600; // seconds

/**
 * 기사 텍스트에서 관련 스타일북 규칙 검색
 * @param {string} articleText
 * @param {{limit?:number, threshold?:number, cacheKey?:string}} [options]
 * @returns {Promise<Array>}
 */
async function findRelevantStyleguides(
  articleText,
  { limit = 10, threshold = 0.75, cacheKey } = {}
) {
  try {
    /* 0. Redis 캐시 확인 */
    if (cacheKey) {
      const hit = await redis.get(cacheKey);
      if (hit) {
        logger.debug(`vectorSearch cache HIT (${cacheKey})`);
        return JSON.parse(hit);
      }
    }

    /* 1. 기사 임베딩 (앞 15k 문자 한정) */
    const embedding = await getEmbedding(articleText.slice(0, 15000));

    /* 2. Vector DB 검색 */
    let results;
    if (VECTOR_DB === "mongodb") {
      results = await mongoSearch(embedding, { limit, threshold });
    } else if (VECTOR_DB === "pinecone") {
      results = await pineconeSearch(embedding, { limit, threshold });
    } else {
      throw new Error(`지원되지 않는 VECTOR_DB_TYPE: ${VECTOR_DB}`);
    }

    /* 3. 캐시 저장 */
    if (cacheKey) {
      await redis.set(cacheKey, JSON.stringify(results), "EX", CACHE_TTL);
    }

    return results;
  } catch (err) {
    logger.error(`스타일북 검색 오류: ${err.message}`);
    throw new Error("관련 스타일북 규칙 검색 중 오류가 발생했습니다.");
  }
}

/**
 * 스타일북 문서(단일) 임베딩 생성 + 필드 주입
 *  - 호출 측에서 save() 필요
 * @param {import('mongoose').Document} styleguideDoc
 * @returns {Promise<import('mongoose').Document>}
 */
async function indexStyleguide(styleguideDoc) {
  try {
    const text = `${styleguideDoc.section}: ${styleguideDoc.content}`;
    styleguideDoc.vector = await getEmbedding(text);
    return styleguideDoc;
  } catch (err) {
    logger.error(`스타일북 인덱싱 오류: ${err.message}`);
    throw new Error("스타일북 벡터 인덱싱 중 오류가 발생했습니다.");
  }
}

module.exports = {
  findRelevantStyleguides,
  indexStyleguide,
};
