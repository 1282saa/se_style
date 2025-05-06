require("dotenv").config();
const fs = require("fs").promises;
const path = require("path");
const mongoose = require("mongoose");
const styleGuideService = require("../src/services/styleGuideService");
const logger = require("../src/utils/logger");
const Styleguide = require("../src/models/styleguide.model");
const config = require("../src/config");
const embeddingProvider = require("../src/services/rag/embeddingProvider");
const { Chroma } = require("@langchain/community/vectorstores/chroma");
const { Document } = require("@langchain/core/documents");

// --- Chroma DB 초기화 ---
let vectorStore = null;
async function initializeVectorStore() {
  const embeddings = embeddingProvider.getEmbeddingsInstance();
  if (!embeddings) {
    logger.error(
      "Chroma 초기화 실패: 유효한 임베딩 모델 인스턴스를 가져올 수 없습니다."
    );
    return null;
  }

  try {
    const persistDirectory = path.resolve(__dirname, "..", "db", "chromadb");
    logger.info(`Chroma DB 영속성 디렉토리: ${persistDirectory}`);

    vectorStore = new Chroma(embeddings, {
      collectionName: config.CHROMA_COLLECTION_NAME || "styleguides",
      persistDirectory: persistDirectory,
    });

    logger.info(
      `Chroma DB 초기화 완료 (컬렉션: ${
        config.CHROMA_COLLECTION_NAME || "styleguides"
      })`
    );
    return vectorStore;
  } catch (error) {
    logger.error(`Chroma DB 초기화 오류: ${error.message}`, {
      stack: error.stack,
    });
    return null;
  }
}
// --- Chroma DB 초기화 끝 ---

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
 * 지정된 디렉토리에서 모든 JSON 스타일북 파일을 처리합니다.
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

    vectorStore = await initializeVectorStore();
    if (!vectorStore) {
      logger.error("Vector Store 초기화 실패. 임포트를 중단합니다.");
      if (mongoose.connection.readyState !== 0) {
        await mongoose.connection.close();
        logger.info("MongoDB 연결 종료");
      }
      process.exit(1);
    }

    let totalMongoCount = 0;
    let totalChromaCount = 0;

    for (const filePath of jsonFiles) {
      const fileName = path.basename(filePath);
      logger.info(`파일 처리 중: ${fileName} (${filePath})`);

      try {
        const { mongoCount, chromaCount } = await importStylebookFromJson(
          filePath,
          vectorStore
        );
        totalMongoCount += mongoCount;
        totalChromaCount += chromaCount;
        logger.info(
          `${fileName} 파일에서 ${mongoCount}개 MongoDB, ${chromaCount}개 Chroma 처리 완료`
        );
      } catch (error) {
        logger.error(`${fileName} 파일 처리 중 오류 발생: ${error.message}`);
      }
    }

    logger.info(
      `모든 파일 처리 완료: 총 ${totalMongoCount}개 MongoDB, ${totalChromaCount}개 Chroma 항목 처리됨`
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
 * 표준화된 스타일북 JSON 파일을 파싱하여 MongoDB와 Chroma에 저장
 * @param {string} filePath - JSON 파일 경로
 * @param {Chroma} vectorStoreInstance - 초기화된 Chroma 인스턴스
 * @returns {Promise<{mongoCount: number, chromaCount: number}>} - 처리된 항목 수
 */
async function importStylebookFromJson(filePath, vectorStoreInstance) {
  let mongoCount = 0;
  let chromaCount = 0;
  const fileName = path.basename(filePath);
  try {
    const jsonData = await fs.readFile(filePath, "utf8");
    const data = JSON.parse(jsonData);

    if (!data || !data.file_id || !Array.isArray(data.rules)) {
      logger.warn(
        `[${fileName}] 건너뛸 수 있습니다: 표준 스타일북 JSON 구조가 아닙니다. (file_id 또는 rules 누락)`
      );
      return { mongoCount, chromaCount };
    }

    if (data.rules.length === 0) {
      logger.info(`[${fileName}] 처리할 규칙(rules)이 없습니다.`);
      return { mongoCount, chromaCount };
    }

    const chromaDocs = [];
    const chromaIds = [];

    for (const rule of data.rules) {
      if (!rule || !rule.rule_id || !rule.content) {
        logger.warn(
          `[${fileName}] 건너뛸 수 있습니다: 유효하지 않은 규칙 데이터입니다. (rule_id 또는 content 누락)`
        );
        continue;
      }

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

      const savedGuide = await saveStyleGuide(styleGuideData);
      if (savedGuide) {
        mongoCount++;

        const metadata = {
          ruleId: savedGuide.ruleId,
          mongoId: savedGuide._id.toString(),
          category: savedGuide.category,
          section: savedGuide.section,
          tags: savedGuide.tags || [],
          priority: savedGuide.priority,
          sourceFile: savedGuide.sourceFile,
        };
        const pageContent = `카테고리: ${metadata.category || ""}\n섹션: ${
          metadata.section || ""
        }\n내용: ${savedGuide.content || ""}`;

        const doc = new Document({
          pageContent: pageContent,
          metadata: metadata,
        });
        chromaDocs.push(doc);
        chromaIds.push(savedGuide.ruleId);
      }
    }

    if (chromaDocs.length > 0 && vectorStoreInstance) {
      try {
        await vectorStoreInstance.addDocuments(chromaDocs, { ids: chromaIds });
        chromaCount = chromaDocs.length;
        logger.debug(
          `[${fileName}] ${chromaCount}개 문서를 Chroma에 추가/업데이트 완료`
        );
      } catch (chromaError) {
        logger.error(
          `[${fileName}] Chroma 문서 추가 중 오류: ${chromaError.message}`,
          { stack: chromaError.stack }
        );
      }
    }

    logger.info(
      `[${fileName}] ${mongoCount}개 MongoDB, ${chromaCount}개 Chroma 처리 완료.`
    );
    return { mongoCount, chromaCount };
  } catch (error) {
    logger.error(
      `스타일북 JSON 파싱/처리 오류 (${fileName}): ${error.message}`,
      { stack: error.stack }
    );
    throw error;
  }
}

/**
 * 스타일 가이드를 데이터베이스에 저장 또는 업데이트
 * @param {Object} styleGuideData - 저장할 스타일 가이드 데이터
 * @returns {Promise<Object | null>} 저장/업데이트된 MongoDB 문서 또는 실패 시 null
 */
async function saveStyleGuide(styleGuideData) {
  try {
    const existingGuide = await Styleguide.findOne({
      ruleId: styleGuideData.ruleId,
    });

    if (existingGuide) {
      Object.assign(existingGuide, styleGuideData);
      existingGuide.updatedAt = new Date();
      await existingGuide.save();
      logger.debug(
        `스타일 가이드 업데이트 (MongoDB): ${styleGuideData.ruleId}`
      );
      return existingGuide;
    } else {
      const newGuide = new Styleguide(styleGuideData);
      await newGuide.save();
      logger.debug(`스타일 가이드 생성 (MongoDB): ${styleGuideData.ruleId}`);
      return newGuide;
    }
  } catch (error) {
    logger.error(
      `스타일 가이드 저장 오류 (MongoDB - ${styleGuideData.ruleId}): ${error.message}`
    );
    return null;
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
