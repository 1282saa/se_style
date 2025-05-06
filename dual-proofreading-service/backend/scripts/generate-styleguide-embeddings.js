// scripts/generate-styleguide-embeddings.js
// 스타일가이드 문서에 임베딩 벡터를 생성하고 MongoDB에 저장하는 스크립트

require("dotenv").config();
const mongoose = require("mongoose");
const { OpenAIEmbeddings } = require("@langchain/openai");
const Styleguide = require("../src/models/styleguide.model");
const logger = require("../src/utils/logger");
const config = require("../src/config");
const embeddingProvider = require("../src/services/rag/embeddingProvider");

// 메인 함수
async function main() {
  try {
    logger.info("스타일가이드 임베딩 생성 스크립트 시작");

    // MongoDB 연결
    await mongoose.connect(config.MONGODB_URI);
    logger.info(`MongoDB 연결 성공: ${config.MONGODB_URI}`);

    // OpenAI API 키 확인
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY가 환경 변수에 설정되지 않았습니다.");
    }

    // 임베딩이 없는 문서 조회
    const docsWithoutEmbedding = await Styleguide.find({
      $or: [
        { vector: { $exists: false } },
        { vector: { $size: 0 } },
        { vector: null },
      ],
    });

    logger.info(`임베딩이 없는 문서 수: ${docsWithoutEmbedding.length}`);

    if (docsWithoutEmbedding.length === 0) {
      logger.info("임베딩이 필요한 문서가 없습니다.");
      await mongoose.disconnect();
      return;
    }

    // 배치 처리 설정
    const batchSize = 20; // 한 번에 처리할 문서 수
    let successCount = 0;
    let errorCount = 0;

    // 배치 처리
    for (let i = 0; i < docsWithoutEmbedding.length; i += batchSize) {
      const batch = docsWithoutEmbedding.slice(i, i + batchSize);
      logger.info(
        `배치 처리 중: ${i + 1}~${i + batch.length}/${
          docsWithoutEmbedding.length
        }`
      );

      // 병렬 처리 (10개씩)
      const results = await Promise.allSettled(
        batch.map(async (doc) => {
          try {
            // 임베딩용 텍스트 생성
            const embeddingText = `
제목: ${doc.section || ""}
내용: ${doc.content || ""}
카테고리: ${doc.category || ""}
${doc.tags && doc.tags.length > 0 ? `태그: ${doc.tags.join(", ")}` : ""}
`.trim();

            // 텍스트가 비어있는 경우 처리하지 않음
            if (!embeddingText.trim()) {
              logger.warn(
                `문서 ID ${doc._id}: 임베딩용 텍스트가 비어 있습니다.`
              );
              return { success: false, id: doc._id, error: "빈 텍스트" };
            }

            // 임베딩 생성
            const embedding = await embeddingProvider.createEmbedding(
              embeddingText
            );

            // 임베딩 유효성 검사
            if (
              !embedding ||
              !Array.isArray(embedding) ||
              embedding.length === 0
            ) {
              logger.warn(
                `문서 ID ${doc._id}: 유효한 임베딩이 생성되지 않았습니다.`
              );
              return {
                success: false,
                id: doc._id,
                error: "유효하지 않은 임베딩",
              };
            }

            // 임베딩 저장
            doc.vector = embedding;
            await doc.save();

            logger.info(
              `문서 ID ${doc._id}: 임베딩 생성 및 저장 완료 (차원: ${embedding.length})`
            );
            return { success: true, id: doc._id };
          } catch (error) {
            logger.error(
              `문서 ID ${doc._id}: 임베딩 생성 오류: ${error.message}`
            );
            return { success: false, id: doc._id, error: error.message };
          }
        })
      );

      // 결과 집계
      const batchResults = results.reduce(
        (acc, result) => {
          if (result.status === "fulfilled" && result.value.success) {
            acc.success++;
          } else {
            acc.error++;
          }
          return acc;
        },
        { success: 0, error: 0 }
      );

      successCount += batchResults.success;
      errorCount += batchResults.error;

      logger.info(
        `배치 결과: 성공 ${batchResults.success}, 실패 ${batchResults.error}`
      );

      // 잠시 대기 (API 속도 제한 방지)
      if (i + batchSize < docsWithoutEmbedding.length) {
        const waitTime = 1000; // 1초
        logger.info(`API 속도 제한 방지를 위해 ${waitTime}ms 대기...`);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }

    // 최종 결과 로깅
    logger.info(
      `임베딩 생성 작업 완료: 총 ${docsWithoutEmbedding.length}개 중 ${successCount}개 성공, ${errorCount}개 실패`
    );

    // 결과 문서 수 확인
    const docsWithEmbedding = await Styleguide.countDocuments({
      vector: { $exists: true, $ne: null },
    });

    logger.info(`현재 임베딩이 있는 문서 수: ${docsWithEmbedding}`);

    // MongoDB 연결 종료
    await mongoose.disconnect();
    logger.info("MongoDB 연결 종료");
  } catch (error) {
    logger.error(`스크립트 실행 중 오류 발생: ${error.message}`, {
      stack: error.stack,
    });

    // MongoDB 연결 종료
    try {
      await mongoose.disconnect();
      logger.info("MongoDB 연결 종료");
    } catch (disconnectError) {
      logger.error(`MongoDB 연결 종료 오류: ${disconnectError.message}`);
    }

    process.exit(1);
  }
}

// 스크립트 실행
main()
  .then(() => {
    logger.info("스크립트 정상 종료");
    process.exit(0);
  })
  .catch((error) => {
    logger.error(`스크립트 실행 실패: ${error.message}`, {
      stack: error.stack,
    });
    process.exit(1);
  });
