require("dotenv").config();
const fs = require("fs").promises;
const path = require("path");
const mongoose = require("mongoose");
// const styleGuideService = require("../src/services/styleGuideService"); // 사용하지 않으므로 제거
const logger = require("../src/utils/logger");
const Styleguide = require("../src/models/styleguide.model");
const config = require("../src/config");
const embeddingProvider = require("../src/services/rag/embeddingProvider");
// Chroma 및 Document 관련 import 제거
// const { Chroma } = require("@langchain/community/vectorstores/chroma");
// const { Document } = require("@langchain/core/documents");

// --- Chroma DB 초기화 로직 전체 제거 ---
// let vectorStore = null;
// async function initializeVectorStore() { ... }

/**
 * 지정된 디렉토리와 그 하위 디렉토리에서 모든 JSON 파일을 재귀적으로 찾습니다.
 * @param {string} dir - 검색을 시작할 디렉토리 경로
 * @returns {Promise<string[]>} - 찾은 JSON 파일 경로 배열
 */
async function findJsonFilesRecursive(dir) {
  let jsonFiles = [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        jsonFiles = jsonFiles.concat(await findJsonFilesRecursive(fullPath));
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".json")) {
        if (!entry.name.startsWith("_")) {
          jsonFiles.push(fullPath);
        }
      }
    }
  } catch (error) {
    logger.warn(`디렉토리 접근/읽기 오류: ${dir} - ${error.message}`);
  }
  return jsonFiles;
}

/**
 * 지정된 디렉토리에서 모든 JSON 스타일북 파일을 처리하고 MongoDB에 임베딩 저장
 * @param {string} directoryPath - JSON 파일이 있는 디렉토리 경로
 */
async function importAllStylebooks(directoryPath) {
  try {
    logger.info(`스타일북 디렉토리 검색 중 (하위 포함): ${directoryPath}`);
    if (
      !(await fs
        .stat(directoryPath)
        .then((s) => s.isDirectory())
        .catch(() => false))
    ) {
      logger.error(
        `지정된 경로가 디렉토리가 아니거나 접근할 수 없습니다: ${directoryPath}`
      );
      process.exit(1);
    }

    const jsonFiles = await findJsonFilesRecursive(directoryPath);

    logger.info(`총 ${jsonFiles.length}개의 JSON 파일을 발견했습니다.`);

    if (jsonFiles.length === 0) {
      logger.warn("처리할 JSON 파일이 없습니다.");
      return;
    }

    await mongoose.connect(config.MONGODB_URI);
    logger.info("MongoDB 연결 완료");

    // --- Chroma DB 초기화 호출 제거 ---
    // vectorStore = await initializeVectorStore();
    // if (!vectorStore) { ... }

    let totalMongoCount = 0;
    let totalEmbeddingCount = 0;
    // --- totalChromaCount 제거 ---

    for (const filePath of jsonFiles) {
      const fileName = path.basename(filePath);
      logger.info(`파일 처리 중: ${fileName} (${filePath})`);

      try {
        // MongoDB 저장 및 임베딩 생성
        const { mongoCount, embeddingCount } = await importStylebookFromJson(
          filePath
          // --- vectorStore 인자 제거 ---
        );
        totalMongoCount += mongoCount;
        totalEmbeddingCount += embeddingCount;
        logger.info(
          `${fileName} 파일에서 ${mongoCount}개 MongoDB 저장, ${embeddingCount}개 임베딩 생성 완료`
        );
      } catch (error) {
        logger.error(`${fileName} 파일 처리 중 오류 발생: ${error.message}`);
      }
    }

    logger.info(
      `모든 파일 처리 완료: 총 ${totalMongoCount}개 MongoDB 저장, ${totalEmbeddingCount}개 임베딩 생성됨`
      // --- Chroma 카운트 로깅 제거 ---
    );
  } catch (error) {
    logger.error(`스타일북 가져오기 오류: ${error.message}`, {
      stack: error.stack,
    });
    throw error;
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
      logger.info("MongoDB 연결 종료");
    }
  }
}

/**
 * 표준화된 스타일북 JSON 파일을 파싱하여 MongoDB에 저장하고 임베딩 생성/업데이트
 * @param {string} filePath - JSON 파일 경로
 * @returns {Promise<{mongoCount: number, embeddingCount: number}>} - 처리된 항목 수
 */
async function importStylebookFromJson(
  filePath /* --- vectorStoreInstance 인자 제거 --- */
) {
  let mongoCount = 0;
  let embeddingCount = 0;
  // --- chromaCount 제거 ---
  const fileName = path.basename(filePath);
  try {
    const jsonData = await fs.readFile(filePath, "utf8");
    const data = JSON.parse(jsonData);

    if (!data || !data.file_id || !Array.isArray(data.rules)) {
      logger.warn(
        `[${fileName}] 건너뛸 수 있습니다: 표준 스타일북 JSON 구조가 아닙니다. (file_id 또는 rules 누락)`
      );
      return { mongoCount, embeddingCount };
    }

    if (data.rules.length === 0) {
      logger.info(`[${fileName}] 처리할 규칙(rules)이 없습니다.`);
      return { mongoCount, embeddingCount };
    }

    // 각 규칙(rule) 처리
    for (const rule of data.rules) {
      if (!rule || !rule.rule_id || !rule.content) {
        logger.warn(
          `[${fileName}] 건너뛸 수 있습니다: 유효하지 않은 규칙 데이터입니다. (rule_id 또는 content 누락)`
        );
        continue;
      }

      // Styleguide 모델에 맞게 데이터 매핑
      const styleGuideData = {
        ruleId: rule.rule_id,
        section: rule.title || data.title || "섹션 없음",
        content: rule.content,
        category: data.category_path ? data.category_path.join("/") : "일반",
        priority: rule.priority || 3,
        tags: (rule.tags || [])
          .concat(data.tags || [])
          .filter(
            (tag, index, self) =>
              typeof tag === "string" &&
              tag.trim() !== "" &&
              self.indexOf(tag) === index
          ),
        examples: Array.isArray(rule.examples)
          ? rule.examples
              .map((ex) => ({
                incorrect: ex.incorrect || "",
                correct: ex.correct || "",
                explanation: ex.description || ex.explanation || "",
              }))
              .filter((ex) => ex.incorrect || ex.correct)
          : [],
        isActive: rule.isActive !== undefined ? rule.isActive : true,
        sourceFile: fileName,
        description:
          rule.explanation ||
          rule.content.substring(0, 100) +
            (rule.content.length > 100 ? "..." : ""),
      };

      // 1. MongoDB에 저장 또는 업데이트
      const savedGuide = await saveStyleGuide(styleGuideData);

      // 2. MongoDB 저장 성공 시 임베딩 생성 및 업데이트
      if (savedGuide) {
        mongoCount++;
        try {
          // 임베딩 생성할 텍스트 구성
          const embeddingText = `카테고리: ${
            savedGuide.category || ""
          }\n섹션: ${savedGuide.section || ""}\n내용: ${
            savedGuide.content || ""
          }`;

          // 임베딩 생성
          const embedding = await embeddingProvider.createEmbedding(
            embeddingText
          );

          if (!embedding || embedding.length === 0) {
            throw new Error("생성된 임베딩 벡터가 비어있습니다.");
          }

          // MongoDB 문서에 임베딩 업데이트
          await Styleguide.updateOne(
            { _id: savedGuide._id },
            { $set: { embedding: embedding, updatedAt: new Date() } }
          );
          embeddingCount++;
          logger.debug(`임베딩 생성 및 저장 완료: ${savedGuide.ruleId}`);
        } catch (embeddingError) {
          logger.error(
            `임베딩 생성/저장 오류 (RuleID: ${savedGuide.ruleId}): ${embeddingError.message}`
          );
          // 임베딩 실패 시 어떻게 처리할지? (예: 로그만 남기고 계속 진행)
        }
      }
      // --- 기존 Chroma 저장 로직 제거 ---
    }

    logger.info(
      `[${fileName}] ${mongoCount}개 MongoDB 저장, ${embeddingCount}개 임베딩 생성 완료.`
    );
    return { mongoCount, embeddingCount };
    // --- Chroma 카운트 반환 제거 ---
  } catch (error) {
    logger.error(
      `스타일북 JSON 파싱/처리 오류 (${fileName}): ${error.message}`,
      { stack: error.stack }
    );
    throw error;
  }
}

/**
 * 스타일 가이드를 데이터베이스에 저장 또는 업데이트 (임베딩 저장 로직은 여기서 제외)
 * @param {Object} styleGuideData - 저장할 스타일 가이드 데이터 (embedding 필드 제외)
 * @returns {Promise<Object | null>} 저장/업데이트된 MongoDB 문서 또는 실패 시 null
 */
async function saveStyleGuide(styleGuideData) {
  try {
    const existingGuide = await Styleguide.findOne({
      ruleId: styleGuideData.ruleId,
    });

    // embedding 필드는 이 함수에서 직접 다루지 않음
    const dataToSave = { ...styleGuideData };
    delete dataToSave.embedding; // 혹시라도 포함되어 있다면 제거

    if (existingGuide) {
      // 업데이트
      Object.assign(existingGuide, dataToSave);
      existingGuide.updatedAt = new Date();
      await existingGuide.save();
      logger.debug(
        `스타일 가이드 업데이트 (MongoDB): ${styleGuideData.ruleId}`
      );
      return existingGuide;
    } else {
      // 새로 생성
      const newGuide = new Styleguide(dataToSave);
      await newGuide.save();
      logger.debug(`스타일 가이드 생성 (MongoDB): ${styleGuideData.ruleId}`);
      return newGuide;
    }
  } catch (error) {
    logger.error(
      `스타일 가이드 저장 오류 (MongoDB - ${styleGuideData.ruleId}): ${error.message}`
    );
    return null; // 실패 시 null 반환
  }
}

// 메인 실행 로직
async function main() {
  const projectRoot = path.resolve(__dirname, "../../..");
  const defaultPath = path.join(projectRoot, "스타일북");
  const directoryPath = process.argv[2] || defaultPath;

  logger.info(`스타일북 가져오기 시작: ${directoryPath}`);
  try {
    await importAllStylebooks(directoryPath);
    logger.info("스타일북 가져오기 작업 완료.");
    process.exit(0);
  } catch (error) {
    logger.error("스타일북 가져오기 작업 중 심각한 오류 발생.");
    process.exit(1);
  }
}

// 스크립트 실행
main();
