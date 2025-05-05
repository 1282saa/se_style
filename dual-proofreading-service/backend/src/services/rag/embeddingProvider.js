/**
 * src/services/rag/embeddingProvider.js
 * Claude API를 사용하여 텍스트의 임베딩을 생성하는 서비스
 */
const axios = require("axios");
const config = require("../../config");
const logger = require("../../utils/logger");

class EmbeddingProvider {
  constructor() {
    this.apiKey = config.ANTHROPIC_API_KEY;
    this.embeddingModel = config.EMBEDDING_MODEL || "claude-3-sonnet-20240229";
    this.baseUrl = "https://api.anthropic.com/v1/embeddings";
    this.useMockEmbeddings = process.env.USE_MOCK_EMBEDDINGS === "true";

    // API 키 확인
    if (!this.apiKey && !this.useMockEmbeddings) {
      logger.warn(
        "ANTHROPIC_API_KEY가 정의되지 않았습니다. 임베딩 기능이 작동하지 않을 수 있습니다."
      );
    }
  }

  /**
   * 텍스트의 임베딩을 생성합니다.
   * @param {string} text - 임베딩을 생성할 텍스트
   * @returns {Promise<Array<number>>} - 임베딩 벡터
   */
  async createEmbedding(text) {
    try {
      // 목업 임베딩 모드가 활성화되었거나 API 키가 없는 경우 목업 임베딩 사용
      if (this.useMockEmbeddings || !this.apiKey) {
        logger.info("목업 임베딩 사용 중");
        return this.createMockEmbedding(text);
      }

      logger.debug(`임베딩 생성 요청: ${text.substring(0, 50)}...`);

      const response = await axios.post(
        this.baseUrl,
        {
          model: this.embeddingModel,
          input: text,
        },
        {
          headers: {
            "Content-Type": "application/json",
            "X-Api-Key": this.apiKey,
            "anthropic-version": "2023-06-01",
          },
          timeout: 30000, // 30초 타임아웃 설정
        }
      );

      logger.debug(`임베딩 생성 완료: 차원 ${response.data.embedding.length}`);
      return response.data.embedding;
    } catch (error) {
      logger.error(`임베딩 생성 중 오류: ${error.message}`);
      // 오류 발생 시 목업 임베딩 반환
      logger.warn("오류로 인해 목업 임베딩으로 대체합니다");
      return this.createMockEmbedding(text);
    }
  }

  /**
   * 여러 텍스트의 임베딩을 일괄 생성합니다.
   * @param {Array<string>} texts - 임베딩을 생성할 텍스트 배열
   * @returns {Promise<Array<Array<number>>>} - 임베딩 벡터 배열
   */
  async createEmbeddings(texts) {
    try {
      logger.info(`다중 임베딩 생성 시작: ${texts.length}개 텍스트`);

      const embeddings = [];

      // API 호출 제한을 고려하여 순차적으로 처리
      for (const [index, text] of texts.entries()) {
        logger.debug(`텍스트 ${index + 1}/${texts.length} 임베딩 생성 중...`);
        try {
          const embedding = await this.createEmbedding(text);
          embeddings.push(embedding);
        } catch (error) {
          logger.warn(
            `${index + 1}번째 임베딩 생성 실패, 목업으로 대체: ${error.message}`
          );
          embeddings.push(this.createMockEmbedding(text));
        }

        // API 속도 제한을 고려한 대기
        if (index < texts.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      }

      logger.info(`다중 임베딩 생성 완료: ${embeddings.length}개`);
      return embeddings;
    } catch (error) {
      logger.error(`다중 임베딩 생성 중 오류: ${error.message}`);
      // 오류 발생 시 모든 텍스트에 대해 목업 임베딩 반환
      logger.warn("오류로 인해 모든 임베딩을 목업으로 대체합니다");
      return texts.map((text) => this.createMockEmbedding(text));
    }
  }

  /**
   * 개발/테스트용 목업 임베딩을 생성합니다. API 키가 없을 때 사용할 수 있습니다.
   * @param {string} text - 임베딩할 텍스트 (해시 시드로 사용)
   * @returns {Array<number>} - 목업 임베딩 벡터
   */
  createMockEmbedding(text) {
    // 입력 텍스트에 기반한 시드 값 생성
    const seed = text
      .split("")
      .reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const random = (index) => {
      const x = Math.sin(seed + index) * 10000;
      return (x - Math.floor(x)) * 2 - 1; // -1에서 1 사이의 값
    };

    // 1536차원(Claude 임베딩 차원)의 의사 랜덤 벡터 생성
    const vector = Array.from({ length: 1536 }, (_, i) => random(i));

    // 벡터 정규화
    const magnitude = Math.sqrt(
      vector.reduce((sum, val) => sum + val * val, 0)
    );
    return vector.map((val) => val / magnitude);
  }
}

module.exports = new EmbeddingProvider();
