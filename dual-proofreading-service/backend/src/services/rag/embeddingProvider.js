/**
 * src/services/rag/embeddingProvider.js
 * OpenAI API를 사용하여 텍스트의 임베딩을 생성하는 서비스
 */
const config = require("../../config");
const logger = require("../../utils/logger");
const { OpenAIEmbeddings } = require("@langchain/openai");
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

// 목업 임베딩 비활성화 - 실제 OpenAI 임베딩 사용
const useMock = false;

// --- OpenAI Embeddings 초기화 ---
let openAIEmbeddings = null;

// OpenAI API 초기화
try {
  openAIEmbeddings = new OpenAIEmbeddings({
    openAIApiKey: process.env.OPENAI_API_KEY, // .env 파일에 OPENAI_API_KEY 설정 필요
    modelName: "text-embedding-3-small", // 최신 임베딩 모델 사용
    dimensions: 1536, // 차원 수 지정 (기본값: 1536)
    batchSize: 100, // 배치 크기 설정 (선택 사항)
    stripNewLines: true, // 줄바꿈 제거 (선택 사항)
  });
  logger.info(`OpenAI Embeddings 초기화 완료 (모델: text-embedding-3-small)`);
} catch (error) {
  logger.error(`OpenAI Embeddings 초기화 오류: ${error.message}`);
  // openAIEmbeddings는 null 상태로 유지됨
}
// --- OpenAI Embeddings 초기화 끝 ---

class EmbeddingProvider {
  constructor() {
    if (!openAIEmbeddings && !useMock) {
      logger.warn(
        "OpenAI Embeddings 클라이언트가 준비되지 않았습니다. 임베딩 기능이 목업으로 대체될 수 있습니다."
      );
    }
  }

  /**
   * 텍스트의 임베딩을 생성합니다.
   * @param {string} text - 임베딩을 생성할 텍스트
   * @returns {Promise<Array<number>>} - 임베딩 벡터
   */
  async createEmbedding(text) {
    if (useMock) {
      logger.debug("목업 임베딩 사용 중");
      return this.createMockEmbedding(text);
    }

    if (!openAIEmbeddings) {
      logger.warn("OpenAI Embeddings 사용 불가, 목업 임베딩 반환");
      return this.createMockEmbedding(text);
    }

    let retries = 0;
    while (retries < MAX_RETRIES) {
      try {
        // --- OpenAI Embeddings 호출 로직 ---
        logger.debug("OpenAI embedQuery 요청");
        // embedQuery는 단일 텍스트에 대한 임베딩 생성
        const embedding = await openAIEmbeddings.embedQuery(text);

        if (!embedding || embedding.length === 0) {
          throw new Error("OpenAI 임베딩 결과가 비어있습니다.");
        }

        logger.debug(`OpenAI 임베딩 생성 완료: 차원 ${embedding.length}`);
        return embedding;
        // --- OpenAI Embeddings 호출 로직 끝 ---
      } catch (error) {
        logger.error(`OpenAI Embedding 오류: ${error.message}`, {
          stack: error.stack,
        });
        retries++;
        if (retries >= MAX_RETRIES) {
          logger.error("최대 재시도 횟수 초과, 목업 임베딩 반환");
          return this.createMockEmbedding(text);
        }
        logger.warn(`${retries}번째 재시도... (${RETRY_DELAY}ms 후)`);
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
      }
    }
    logger.error("알 수 없는 오류로 임베딩 생성 실패, 목업 반환");
    return this.createMockEmbedding(text);
  }

  /**
   * 여러 텍스트의 임베딩을 일괄 생성합니다.
   * @param {Array<string>} texts - 임베딩을 생성할 텍스트 배열
   * @returns {Promise<Array<Array<number>>>} - 임베딩 벡터 배열
   */
  async createEmbeddings(texts) {
    if (useMock) {
      logger.debug(
        `목업 모드: 텍스트 ${texts.length}개에 대한 목업 임베딩 생성`
      );
      return texts.map((text) => this.createMockEmbedding(text));
    }

    if (!openAIEmbeddings) {
      logger.warn(
        `OpenAI 사용 불가: 텍스트 ${texts.length}개에 대한 목업 임베딩 반환`
      );
      return texts.map((text) => this.createMockEmbedding(text));
    }

    try {
      logger.info(`OpenAI 다중 임베딩 생성 시작: ${texts.length}개 텍스트`);
      // embedDocuments는 여러 텍스트를 받아 임베딩 배열 반환
      const embeddings = await openAIEmbeddings.embedDocuments(texts);

      if (!embeddings || embeddings.length !== texts.length) {
        throw new Error(
          `임베딩 결과 개수(${embeddings?.length || 0})가 입력 텍스트 개수(${
            texts.length
          })와 일치하지 않습니다.`
        );
      }

      logger.info(`OpenAI 다중 임베딩 생성 완료: ${embeddings.length}개`);
      return embeddings;
    } catch (error) {
      logger.error(`OpenAI 다중 임베딩 생성 오류: ${error.message}`, {
        stack: error.stack,
      });
      logger.warn("오류로 인해 모든 임베딩을 목업으로 대체합니다");
      return texts.map((text) => this.createMockEmbedding(text));
    }
  }

  /**
   * 개발/테스트용 목업 임베딩을 생성합니다.
   * @param {string} text - 임베딩할 텍스트 (해시 시드로 사용)
   * @returns {Array<number>} - 목업 임베딩 벡터 (1536차원)
   */
  createMockEmbedding(text) {
    const seed = text
      .split("")
      .reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const random = (index) => {
      const x = Math.sin(seed + index) * 10000;
      return (x - Math.floor(x)) * 2 - 1;
    };

    // OpenAI text-embedding-3-small 모델의 차원 수: 1536
    const dimension = 1536;
    const vector = Array.from({ length: dimension }, (_, i) => random(i));

    const magnitude = Math.sqrt(
      vector.reduce((sum, val) => sum + val * val, 0)
    );
    if (magnitude === 0) return Array(dimension).fill(0);
    return vector.map((val) => val / magnitude);
  }
}

// getEmbeddingsInstance 함수 제거 및 원래 방식대로 인스턴스 export
module.exports = new EmbeddingProvider();
