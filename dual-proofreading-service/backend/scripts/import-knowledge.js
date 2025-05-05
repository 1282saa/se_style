/**
 * 교열 규칙 날리지 XML 파일을 파싱하여 MongoDB에 저장하는 스크립트
 */
const fs = require("fs");
const path = require("path");
const xml2js = require("xml2js");
const mongoose = require("mongoose");
const logger = require("../src/utils/logger");
const config = require("../src/config");

// 날리지 모델 임포트
const Knowledge = require("../src/models/knowledge.model");

// 임베딩 서비스
const embeddingProvider = require("../src/services/rag/embeddingProvider");

/**
 * 날리지 XML 파일을 파싱하여 MongoDB에 저장
 * @param {string} filePath - XML 파일 경로
 * @returns {Promise<number>} - 저장된 항목 수
 */
async function importKnowledgeFromXml(filePath) {
  try {
    logger.info(`${path.basename(filePath)} 파일 처리 시작`);

    // XML 파일 읽기
    if (!fs.existsSync(filePath)) {
      logger.error(`파일이 존재하지 않습니다: ${filePath}`);
      return 0;
    }

    const xmlData = fs.readFileSync(filePath, "utf8");

    // XML 파싱
    const parser = new xml2js.Parser({ explicitArray: false });
    const result = await parser.parseStringPromise(xmlData);

    if (!result || !result.knowledge) {
      logger.error(
        `${path.basename(filePath)} 파일이 유효한 날리지 XML 형식이 아닙니다`
      );
      return 0;
    }

    // 규칙이 없는 경우
    if (!result.knowledge.rule) {
      logger.warn(`${path.basename(filePath)} 파일에 규칙이 없습니다`);
      return 0;
    }

    // 규칙 배열로 변환 (단일 항목인 경우 배열로 변환)
    const rules = Array.isArray(result.knowledge.rule)
      ? result.knowledge.rule
      : [result.knowledge.rule];

    // 파일 유형 추출 (파일명에서)
    const fileBasename = path.basename(filePath);
    let fileType = "일반";

    // 파일명에서 유형 추출 시도
    try {
      const nameParts = fileBasename.split(" ")[0].toLowerCase();
      fileType = nameParts || "일반";
    } catch (nameError) {
      logger.warn(
        `파일명에서 유형 추출 실패: ${fileBasename}. 기본값 '일반' 사용`
      );
    }

    logger.info(`${rules.length}개 규칙 처리 중...`);

    // 각 규칙 처리
    const processedRules = [];
    for (const rule of rules) {
      try {
        if (!rule) {
          logger.warn("빈 규칙 건너뜀");
          continue;
        }

        // 필수 속성 확인
        if (!rule.content && !rule.text) {
          logger.warn("내용이 없는 규칙 건너뜀");
          continue;
        }

        // 예제 처리
        const examples = [];
        if (rule.examples && rule.examples.example) {
          const exampleItems = Array.isArray(rule.examples.example)
            ? rule.examples.example
            : [rule.examples.example];

          for (const example of exampleItems) {
            if (!example) continue;

            examples.push({
              incorrect: example.incorrect || "",
              correct: example.correct || "",
              explanation: example.explanation || "",
            });
          }
        }

        // 태그 처리
        const tags = [];
        if (rule.tags && rule.tags.tag) {
          const tagItems = Array.isArray(rule.tags.tag)
            ? rule.tags.tag
            : [rule.tags.tag];

          // 유효한 태그만 필터링
          tagItems.forEach((tag) => {
            if (tag && typeof tag === "string" && tag.trim()) {
              tags.push(tag.trim());
            }
          });
        }

        // 규칙 객체 생성
        const knowledgeItem = {
          sourceFile: fileBasename,
          type: rule.type || fileType,
          category: rule.category || "일반",
          rule: rule.content || rule.text || "",
          explanation: rule.explanation || "",
          examples: examples,
          priority: parseInt(rule.priority || "3", 10),
          tags: tags,
        };

        // 기존 항목 찾기
        const existingItem = await Knowledge.findOne({
          type: knowledgeItem.type,
          category: knowledgeItem.category,
          rule: knowledgeItem.rule,
        });

        if (existingItem) {
          // 기존 항목 업데이트
          Object.assign(existingItem, knowledgeItem);
          existingItem.updatedAt = new Date();
          await existingItem.save();
          processedRules.push(existingItem);
          logger.debug(
            `규칙 업데이트: ${
              knowledgeItem.category
            } - ${knowledgeItem.rule.substring(0, 30)}...`
          );
        } else {
          // 새 항목 생성
          const newKnowledge = new Knowledge(knowledgeItem);
          await newKnowledge.save();
          processedRules.push(newKnowledge);
          logger.debug(
            `새 규칙 추가: ${
              knowledgeItem.category
            } - ${knowledgeItem.rule.substring(0, 30)}...`
          );
        }
      } catch (ruleError) {
        logger.error(`규칙 처리 중 오류: ${ruleError.message}`);
      }
    }

    logger.info(`${processedRules.length}개 규칙 처리 완료`);
    return processedRules.length;
  } catch (error) {
    logger.error(
      `파일 처리 오류 (${path.basename(filePath)}): ${error.message}`
    );
    return 0;
  }
}

/**
 * 모든 날리지 항목에 임베딩 생성
 * @returns {Promise<number>} - 임베딩이 생성된 항목 수
 */
async function generateEmbeddings() {
  try {
    logger.info("날리지 임베딩 생성 시작");

    // 임베딩이 없는 항목 조회
    const items = await Knowledge.find({
      $or: [
        { vector: { $exists: false } },
        { vector: { $size: 0 } },
        { vector: null },
      ],
    }).limit(1000); // 한 번에 처리할 최대 개수 제한

    if (items.length === 0) {
      logger.info("임베딩이 필요한 항목이 없습니다");
      return 0;
    }

    logger.info(`${items.length}개 항목 임베딩 생성 중...`);

    let successCount = 0;
    for (const [index, item] of items.entries()) {
      try {
        // 텍스트 결합
        const text = `${item.type} ${item.category} ${item.rule} ${item.explanation}`;

        // 임베딩 생성
        const embedding = await embeddingProvider.createEmbedding(text);

        // 유효한 임베딩인지 확인
        if (!embedding || !Array.isArray(embedding) || embedding.length === 0) {
          logger.warn(`${item._id} 항목에 대한 임베딩이 생성되지 않음`);
          continue;
        }

        // 임베딩 저장
        item.vector = embedding;
        await item.save();

        successCount++;

        if (index % 10 === 0) {
          logger.info(`${index + 1}/${items.length} 항목 임베딩 생성 완료`);
        }
      } catch (embeddingError) {
        logger.error(
          `임베딩 생성 오류 (ID: ${item._id}): ${embeddingError.message}`
        );
      }
    }

    logger.info(`총 ${successCount}/${items.length} 항목 임베딩 생성 완료`);
    return successCount;
  } catch (error) {
    logger.error(`임베딩 생성 중 오류: ${error.message}`);
    return 0;
  }
}

/**
 * 메인 실행 함수
 */
async function main() {
  try {
    // MongoDB 연결
    await mongoose.connect(config.MONGODB_URI);
    logger.info("MongoDB 연결 성공");

    // 명령행 인수 확인
    const args = process.argv.slice(2);
    let knowledgeDir = args[0];

    // 기본 경로 설정 (프롬프트 폴더 찾기)
    if (!knowledgeDir) {
      // 프로젝트 루트에서 상대 경로로 프롬프트 폴더 찾기
      const possiblePaths = [
        path.join(__dirname, "../../프롬프트/날리지"),
        path.join(__dirname, "../프롬프트/날리지"),
        path.join(__dirname, "../../프롬프트"),
        path.join(process.cwd(), "프롬프트/날리지"),
      ];

      for (const possiblePath of possiblePaths) {
        if (fs.existsSync(possiblePath)) {
          knowledgeDir = possiblePath;
          logger.info(`프롬프트 폴더 발견: ${knowledgeDir}`);
          break;
        }
      }

      // 폴더를 찾지 못한 경우
      if (!knowledgeDir) {
        knowledgeDir = path.join(__dirname, "../../프롬프트/날리지");
        logger.warn(
          `기본 프롬프트 폴더를 찾지 못했습니다. 기본값 사용: ${knowledgeDir}`
        );
      }
    }

    // 절대 경로로 변환
    if (!path.isAbsolute(knowledgeDir)) {
      knowledgeDir = path.resolve(process.cwd(), knowledgeDir);
    }

    // 경로 확인
    if (!fs.existsSync(knowledgeDir)) {
      logger.error(`경로가 존재하지 않습니다: ${knowledgeDir}`);
      console.error("\n데이터 폴더 경로를 직접 지정하세요:");
      console.error("npm run import-knowledge -- /path/to/knowledge/files\n");
      process.exit(1);
    }

    // 디렉토리인지 확인
    const isDirectory = fs.statSync(knowledgeDir).isDirectory();

    let totalRules = 0;
    if (isDirectory) {
      // 디렉토리 내의 모든 XML 파일 처리
      const files = fs
        .readdirSync(knowledgeDir)
        .filter((file) => file.endsWith(".xml"))
        .map((file) => path.join(knowledgeDir, file));

      if (files.length === 0) {
        logger.error(`${knowledgeDir} 폴더에 XML 파일이 없습니다`);
        process.exit(1);
      }

      logger.info(`${files.length}개 XML 파일 찾음`);

      // 각 파일 처리
      for (const file of files) {
        try {
          const ruleCount = await importKnowledgeFromXml(file);
          totalRules += ruleCount;
        } catch (fileError) {
          logger.error(
            `파일 가져오기 실패 (${path.basename(file)}): ${fileError.message}`
          );
        }
      }
    } else if (knowledgeDir.endsWith(".xml")) {
      // 단일 XML 파일 처리
      totalRules = await importKnowledgeFromXml(knowledgeDir);
    } else {
      logger.error("XML 파일 또는 디렉토리를 지정해주세요");
      process.exit(1);
    }

    logger.info(`총 ${totalRules}개 규칙 가져오기 완료`);

    // 임베딩 생성
    if (totalRules > 0) {
      const embeddingsCount = await generateEmbeddings();
      logger.info(`임베딩 생성 작업 완료: ${embeddingsCount}개 생성됨`);
    }

    logger.info("작업 완료");

    // 데이터베이스 연결 종료
    await mongoose.connection.close();
    logger.info("MongoDB 연결 종료");

    process.exit(0);
  } catch (error) {
    logger.error(`스크립트 실행 오류: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

// 스크립트 실행
main();
