// src/services/rag/embeddings.service.js
const axios = require("axios");
const mongoose = require("mongoose");
const StyleGuide = require("../../models/styleguide.model");
const config = require("../../config");
const logger = require("../../utils/logger");

class EmbeddingsService {
  /**
   * OpenAI API를 사용하여 텍스트 임베딩을 생성합니다.
   * @param {string|string[]} texts - 임베딩할 텍스트 또는 텍스트 배열
   * @returns {Promise<Array|Array[]>} - 임베딩 벡터 또는 벡터 배열
   */
  async generateEmbeddings(texts) {
    try {
      // 입력이 문자열인 경우 배열로 변환
      const textArray = Array.isArray(texts) ? texts : [texts];

      // OpenAI API 호출
      const response = await axios.post(
        "https://api.openai.com/v1/embeddings",
        {
          input: textArray,
          model: config.EMBEDDING_MODEL || "text-embedding-3-small",
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.OPENAI_API_KEY}`,
          },
        }
      );

      // 응답에서 임베딩 추출
      const embeddings = response.data.data.map((item) => item.embedding);

      // 입력이 단일 문자열이었으면 첫 번째 임베딩만 반환
      return Array.isArray(texts) ? embeddings : embeddings[0];
    } catch (error) {
      logger.error(`임베딩 생성 오류: ${error.message}`);
      throw new Error(`임베딩 생성 중 오류 발생: ${error.message}`);
    }
  }

  /**
   * 모든 스타일 가이드 규칙에 대한 임베딩을 생성하고 저장합니다.
   * @returns {Promise<Object>} - 임베딩 생성 결과 통계
   */
  async generateAllStyleGuideEmbeddings() {
    try {
      // 모든 스타일 가이드 규칙 조회
      const styleGuides = await StyleGuide.find({});

      logger.info(`임베딩 생성 시작: ${styleGuides.length}개 규칙`);

      const stats = {
        total: styleGuides.length,
        success: 0,
        failed: 0,
        failedIds: [],
      };

      // 배치 처리를 위한 임베딩 요청 규칙 그룹화
      const batchSize = 10; // API 호출당 최대 규칙 수
      const batches = [];

      for (let i = 0; i < styleGuides.length; i += batchSize) {
        batches.push(styleGuides.slice(i, i + batchSize));
      }

      // 각 배치 처리
      for (const [batchIndex, batch] of batches.entries()) {
        logger.info(`배치 ${batchIndex + 1}/${batches.length} 처리 중...`);

        try {
          // 각 규칙에 대한 텍스트 준비
          const batchTexts = batch.map((rule) => {
            const activeVersion =
              rule.versions.find((v) => v.status === "active") ||
              rule.versions[0];
            const { structure } = activeVersion;

            // 임베딩을 위한 텍스트 생성
            return `제목: ${structure.title}
설명: ${structure.description}
태그: ${structure.tags ? structure.tags.join(", ") : ""}`;
          });

          // 배치에 대한 임베딩 생성
          const batchEmbeddings = await this.generateEmbeddings(batchTexts);

          // 각 규칙에 임베딩 저장
          for (let i = 0; i < batch.length; i++) {
            const rule = batch[i];
            rule.vector = batchEmbeddings[i];

            await rule.save();
            stats.success++;
          }
        } catch (error) {
          logger.error(`배치 ${batchIndex + 1} 처리 오류: ${error.message}`);

          // 실패한 규칙 ID 추적
          batch.forEach((rule) => {
            stats.failed++;
            stats.failedIds.push(rule.rule_id);
          });
        }

        // API 속도 제한을 피하기 위한 지연
        if (batchIndex < batches.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      logger.info(`임베딩 생성 완료:
        - 총 규칙: ${stats.total}
        - 성공: ${stats.success}
        - 실패: ${stats.failed}
      `);

      return stats;
    } catch (error) {
      logger.error(`스타일 가이드 임베딩 생성 오류: ${error.message}`);
      throw new Error(
        `스타일 가이드 임베딩 생성 중 오류 발생: ${error.message}`
      );
    }
  }

  /**
   * 벡터 검색 기능 활성화를 위해 MongoDB 인덱스를 생성합니다.
   * @returns {Promise<boolean>} - 인덱스 생성 성공 여부
   */
  async createVectorIndex() {
    try {
      if (!mongoose.connection.db) {
        throw new Error("MongoDB에 연결되어 있지 않습니다.");
      }

      // 벡터 인덱스 생성
      await StyleGuide.collection.createIndex(
        { vector: "vector" },
        {
          name: "vector_index",
          background: true,
        }
      );

      logger.info("벡터 인덱스가 성공적으로 생성되었습니다.");
      return true;
    } catch (error) {
      logger.error(`벡터 인덱스 생성 오류: ${error.message}`);
      throw new Error(`벡터 인덱스 생성 중 오류 발생: ${error.message}`);
    }
  }
}

module.exports = new EmbeddingsService();
