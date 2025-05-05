require("dotenv").config();
const fs = require("fs").promises;
const path = require("path");
const mongoose = require("mongoose");
const styleGuideService = require("../src/services/styleGuideService");
const logger = require("../src/utils/logger");
const { parseStringPromise } = require("xml2js");
const Styleguide = require("../src/models/styleguide.model");
const config = require("../src/config");
const { createEmbedding } = require("../src/services/llm/anthropicService");

// 연결 확인
async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    logger.info(`MongoDB에 연결되었습니다: ${process.env.MONGODB_URI}`);
    return true;
  } catch (error) {
    logger.error(`MongoDB 연결 오류: ${error.message}`);
    return false;
  }
}

// 스타일북 데이터 가져오기
async function importStyleBook() {
  try {
    const connected = await connectDB();
    if (!connected) {
      process.exit(1);
    }

    // 스타일북 데이터 가져오기
    const result = await styleGuideService.importStyleBook(sampleData);
    logger.info(`스타일북 가져오기 결과: ${JSON.stringify(result)}`);

    await mongoose.connection.close();
    logger.info("MongoDB 연결 종료");

    return result;
  } catch (error) {
    logger.error(`스타일북 가져오기 오류: ${error.message}`);
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
    process.exit(1);
  }
}

// 실행
importStyleBook()
  .then((result) => {
    console.log("스타일북 가져오기 완료:", result);
    process.exit(0);
  })
  .catch((error) => {
    console.error("스타일북 가져오기 실패:", error);
    process.exit(1);
  });

/**
 * 지정된 디렉토리에서 모든 XML 파일을 처리합니다.
 * @param {string} directoryPath - XML 파일이 있는 디렉토리 경로
 */
async function importAllStylebooks(directoryPath) {
  try {
    // 디렉토리 내 파일 목록 가져오기
    const files = await fs.readdir(directoryPath);
    const xmlFiles = files.filter((file) =>
      file.toLowerCase().endsWith(".xml")
    );

    logger.info(`총 ${xmlFiles.length}개의 XML 파일을 발견했습니다.`);

    if (xmlFiles.length === 0) {
      logger.warn("처리할 XML 파일이 없습니다.");
      process.exit(0);
    }

    // MongoDB 연결
    await mongoose.connect(config.MONGODB_URI);
    logger.info("MongoDB 연결 완료");

    let totalImportCount = 0;

    // 각 XML 파일 처리
    for (const file of xmlFiles) {
      const filePath = path.join(directoryPath, file);
      logger.info(`파일 처리 중: ${file}`);

      try {
        const importCount = await importStylebookFromXML(filePath, false);
        totalImportCount += importCount;
        logger.info(`${file} 파일에서 ${importCount}개 항목 처리 완료`);
      } catch (error) {
        logger.error(`${file} 파일 처리 중 오류 발생: ${error.message}`);
        // 단일 파일 오류는 전체 프로세스를 중단하지 않음
      }
    }

    // 벡터 임베딩 생성
    await generateEmbeddings();

    logger.info(`모든 파일 처리 완료: 총 ${totalImportCount}개 항목 처리됨`);

    // 연결 종료
    await mongoose.connection.close();
    logger.info("MongoDB 연결 종료");
  } catch (error) {
    logger.error(`스타일북 가져오기 오류: ${error.message}`, {
      stack: error.stack,
    });
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
    process.exit(1);
  }
}

/**
 * 스타일북 XML 파일을 파싱하여 데이터베이스에 저장
 * @param {string} filePath - XML 파일 경로
 * @param {boolean} closeConnection - 함수 종료 시 DB 연결 종료 여부
 * @returns {Promise<number>} - 처리된 항목 수
 */
async function importStylebookFromXML(filePath, closeConnection = true) {
  try {
    // XML 파일 읽기
    const xmlData = await fs.readFile(filePath, "utf8");
    const fileName = path.basename(filePath);

    // 파일명에서 카테고리 결정
    let defaultCategory = "일반";
    if (fileName.includes("맞춤법")) defaultCategory = "맞춤법";
    else if (fileName.includes("문장 구조")) defaultCategory = "문장 구조";
    else if (fileName.includes("논리적 일관성"))
      defaultCategory = "논리적 일관성";
    else if (fileName.includes("경제 전문용어")) defaultCategory = "경제 용어";
    else if (fileName.includes("교열 사례")) defaultCategory = "교열 사례";

    // XML 파싱
    const result = await parseStringPromise(xmlData, {
      explicitArray: false,
      mergeAttrs: true,
    });

    // 파일 구조에 따라 다른 처리 방식 적용
    let importCount = 0;

    if (
      result.SeoulEconomicKnowledgeBase &&
      result.SeoulEconomicKnowledgeBase.KnowledgeCategory
    ) {
      // 기존 형식 처리
      const knowledgeCategory =
        result.SeoulEconomicKnowledgeBase.KnowledgeCategory;

      if (
        knowledgeCategory.RuleCategories &&
        knowledgeCategory.RuleCategories.Category
      ) {
        const categories = Array.isArray(
          knowledgeCategory.RuleCategories.Category
        )
          ? knowledgeCategory.RuleCategories.Category
          : [knowledgeCategory.RuleCategories.Category];

        for (const category of categories) {
          const categoryName = category.name || defaultCategory;
          const rules = Array.isArray(category.Rule)
            ? category.Rule
            : [category.Rule];

          for (const rule of rules) {
            if (!rule) continue; // null 체크

            // 스타일 가이드 객체 생성
            const styleGuide = {
              ruleId:
                rule.id ||
                `${categoryName}-${Date.now()}-${Math.floor(
                  Math.random() * 1000
                )}`,
              section: rule.Title || "제목 없음",
              content: rule.Description || "",
              category: categoryName,
              priority: parseInt(rule.priority) || 3,
              tags: ["맞춤법", categoryName],
              examples: processExamples(rule.Examples),
              isActive: true,
            };

            // 데이터베이스에 저장
            await saveStyleGuide(styleGuide);
            importCount++;
          }
        }
      }
    } else if (result.KnowledgeBase && result.KnowledgeBase.Rule) {
      // 날리지 XML 형식 처리
      const rules = Array.isArray(result.KnowledgeBase.Rule)
        ? result.KnowledgeBase.Rule
        : [result.KnowledgeBase.Rule];

      for (const rule of rules) {
        if (!rule) continue; // null 체크

        // 스타일 가이드 객체 생성
        const styleGuide = {
          ruleId:
            rule.id ||
            `${defaultCategory}-${Date.now()}-${Math.floor(
              Math.random() * 1000
            )}`,
          section: rule.Title || rule.title || "제목 없음",
          content:
            rule.Description ||
            rule.description ||
            rule.Content ||
            rule.content ||
            "",
          category: rule.Category || rule.category || defaultCategory,
          priority: parseInt(rule.Priority || rule.priority) || 3,
          tags: processTagsFromRule(rule, defaultCategory),
          examples: processExamplesAlternative(rule),
          isActive: true,
        };

        // 데이터베이스에 저장
        await saveStyleGuide(styleGuide);
        importCount++;
      }
    } else {
      logger.warn(`${fileName} 파일의 구조를 인식할 수 없습니다.`);
    }

    logger.info(`${fileName} 파일에서 ${importCount}개 항목 처리 완료`);

    // 연결 종료 (옵션에 따라)
    if (closeConnection && mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
      logger.info("MongoDB 연결 종료");
    }

    return importCount;
  } catch (error) {
    logger.error(
      `스타일북 파싱 오류 (${path.basename(filePath)}): ${error.message}`,
      { stack: error.stack }
    );
    if (closeConnection && mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
    throw error;
  }
}

/**
 * 스타일 가이드를 데이터베이스에 저장
 * @param {Object} styleGuide - 스타일 가이드 객체
 */
async function saveStyleGuide(styleGuide) {
  try {
    // 데이터베이스에 저장
    const existingRule = await Styleguide.findOne({
      ruleId: styleGuide.ruleId,
    });

    if (existingRule) {
      // 업데이트
      Object.assign(existingRule, styleGuide);
      await existingRule.save();
      logger.debug(
        `스타일 가이드 업데이트: ${styleGuide.ruleId} - ${styleGuide.section}`
      );
    } else {
      // 새로 생성
      const newGuide = new Styleguide(styleGuide);
      await newGuide.save();
      logger.debug(
        `스타일 가이드 생성: ${styleGuide.ruleId} - ${styleGuide.section}`
      );
    }
  } catch (error) {
    logger.error(
      `스타일 가이드 저장 오류 (${styleGuide.ruleId}): ${error.message}`
    );
    throw error;
  }
}

/**
 * 룰에서 태그 추출
 * @param {Object} rule - 룰 객체
 * @param {string} defaultCategory - 기본 카테고리
 * @returns {Array} - 태그 배열
 */
function processTagsFromRule(rule, defaultCategory) {
  const tags = [defaultCategory];

  // 태그 필드가 있는 경우
  if (rule.Tags || rule.tags) {
    const tagField = rule.Tags || rule.tags;

    if (Array.isArray(tagField)) {
      tags.push(...tagField);
    } else if (typeof tagField === "string") {
      // 쉼표로 구분된 문자열인 경우
      tags.push(...tagField.split(",").map((tag) => tag.trim()));
    } else if (tagField.Tag) {
      // 중첩된 Tag 객체가 있는 경우
      if (Array.isArray(tagField.Tag)) {
        tags.push(...tagField.Tag);
      } else {
        tags.push(tagField.Tag);
      }
    }
  }

  // 카테고리 추가
  if (rule.Category || rule.category) {
    const category = rule.Category || rule.category;
    if (!tags.includes(category)) {
      tags.push(category);
    }
  }

  // 제목에서 키워드 추출
  const title = rule.Title || rule.title || "";
  const keywords = title.split(/[\s,]+/).filter((word) => word.length > 1);
  tags.push(...keywords);

  // 중복 제거 및 공백 제거
  return [...new Set(tags)]
    .filter((tag) => tag && tag.trim().length > 0)
    .map((tag) => tag.trim());
}

/**
 * 대체 예제 처리 방법
 * @param {Object} rule - 룰 객체
 * @returns {Array} - 처리된 예시 배열
 */
function processExamplesAlternative(rule) {
  const examples = [];

  // 예제 필드 처리
  if (rule.Examples || rule.examples) {
    const exampleField = rule.Examples || rule.examples;

    if (exampleField.Example) {
      const exItems = Array.isArray(exampleField.Example)
        ? exampleField.Example
        : [exampleField.Example];

      exItems.forEach((example) => {
        if (typeof example === "string") {
          // 문자열인 경우
          examples.push({
            wrong: "",
            correct: example,
            explanation: "예시",
          });
        } else {
          // 객체인 경우
          examples.push({
            wrong: example.Wrong || example.wrong || "",
            correct: example.Correct || example.correct || "",
            explanation: example.Explanation || example.explanation || "",
          });
        }
      });
    } else if (Array.isArray(exampleField)) {
      // 배열인 경우
      exampleField.forEach((example) => {
        if (typeof example === "string") {
          examples.push({
            wrong: "",
            correct: example,
            explanation: "예시",
          });
        } else {
          examples.push({
            wrong: example.Wrong || example.wrong || "",
            correct: example.Correct || example.correct || "",
            explanation: example.Explanation || example.explanation || "",
          });
        }
      });
    } else if (typeof exampleField === "string") {
      // 문자열인 경우
      examples.push({
        wrong: "",
        correct: exampleField,
        explanation: "예시",
      });
    }
  }

  // 개별 필드 처리 (WrongExample, CorrectExample 등)
  if (rule.WrongExample || rule.wrongExample) {
    const wrong = rule.WrongExample || rule.wrongExample;
    if (typeof wrong === "string") {
      examples.push({
        wrong,
        correct: "",
        explanation: "잘못된 예시",
      });
    }
  }

  if (rule.CorrectExample || rule.correctExample) {
    const correct = rule.CorrectExample || rule.correctExample;
    if (typeof correct === "string") {
      examples.push({
        wrong: "",
        correct,
        explanation: "올바른 예시",
      });
    }
  }

  return examples;
}

/**
 * 예시 데이터 처리
 * @param {Object} examples - 예시 데이터 객체
 * @returns {Array} - 처리된 예시 배열
 */
function processExamples(examples) {
  if (!examples || !examples.Example) return [];

  const exampleItems = Array.isArray(examples.Example)
    ? examples.Example
    : [examples.Example];

  return exampleItems.map((example) => ({
    wrong: example.Wrong || "",
    correct: example.Correct || "",
    explanation: example.Explanation || "",
  }));
}

/**
 * 모든 스타일 가이드에 대한 임베딩 생성
 */
async function generateEmbeddings() {
  try {
    logger.info("벡터 임베딩 생성 시작");

    const styleGuides = await Styleguide.find({
      vector: { $exists: false },
    });

    logger.info(`임베딩 생성 대상: ${styleGuides.length}개 항목`);

    // 청크별로 처리 (API 속도 제한 고려)
    const chunkSize = 5;
    const chunks = [];

    for (let i = 0; i < styleGuides.length; i += chunkSize) {
      chunks.push(styleGuides.slice(i, i + chunkSize));
    }

    let success = 0;
    let failed = 0;

    for (const [index, chunk] of chunks.entries()) {
      logger.info(`청크 ${index + 1}/${chunks.length} 처리 중...`);

      // 각 항목 처리
      for (const guide of chunk) {
        try {
          // 임베딩용 텍스트 생성
          const embeddingText = `
제목: ${guide.section}
내용: ${guide.content}
카테고리: ${guide.category}
${guide.tags && guide.tags.length > 0 ? `태그: ${guide.tags.join(", ")}` : ""}
          `.trim();

          // 임베딩 생성
          const embedding = await createEmbedding(embeddingText);

          // 임베딩 저장
          guide.vector = embedding;
          await guide.save();

          success++;
          logger.debug(`임베딩 생성 성공: ${guide.ruleId} - ${guide.section}`);
        } catch (error) {
          failed++;
          logger.error(`임베딩 생성 실패 (ID: ${guide._id}): ${error.message}`);
        }
      }

      // API 속도 제한을 피하기 위한 지연
      if (index < chunks.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    logger.info(
      `임베딩 생성 완료: 총 ${styleGuides.length}개 중 ${success}개 성공, ${failed}개 실패`
    );
  } catch (error) {
    logger.error(`임베딩 생성 오류: ${error.message}`, { stack: error.stack });
    throw error;
  }
}

// 파일 경로를 인수로 받아 실행
const directoryPath =
  process.argv[2] ||
  "/Users/yeong-gwang/Desktop/work/서울경제신문/개발작업/맞춤형교열시스템개발/프롬프트/날리지";
importAllStylebooks(directoryPath);
