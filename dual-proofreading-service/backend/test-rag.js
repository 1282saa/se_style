/**
 * RAG(Retrieval-Augmented Generation) 시스템 테스트 스크립트
 *
 * 이 스크립트는 교정 시스템의 RAG 기능을 테스트합니다.
 * 다음 기능을 테스트합니다:
 * 1. 기본 검색
 * 2. 계층적 검색
 * 3. 문서 유형별 검색
 * 4. 카테고리 기반 검색
 * 5. 프롬프트 강화
 */

require("dotenv").config();
const axios = require("axios");
const readline = require("readline");
const ragService = require("./src/services/rag/ragService");
const vectorSearch = require("./src/services/rag/vectorSearch");
const mongoose = require("mongoose");
const config = require("./src/config");
const logger = require("./src/utils/logger");

// 테스트 쿼리 샘플
const TEST_QUERIES = [
  {
    name: "짧은 텍스트 예제",
    text: "외래어 표기에 관한 규칙은 어떻게 되나요?",
  },
  {
    name: "중간 길이 텍스트 예제",
    text: "신문 기사에서 인용문을 사용할 때 주의해야 할 점이 있습니까? 특히 여러 문단에 걸친 인용문의 경우 어떻게 표기해야 하는지 궁금합니다. 또한 인용문 내의 생략이나 강조는 어떻게 표시하나요?",
  },
  {
    name: "긴 텍스트 예제",
    text: `서울경제신문은 경제적 자유와 시장경제원리를 근간으로 하는 자유민주체제를 지지한다. 자유민주주의 정치체제와 법치주의, 그리고 시장경제원리가 조화를 이룰 때 국가와 사회는 발전할 수 있으며 개인의 자유와 행복추구도 가능하기 때문이다.

서울경제신문은 경제적 약자와 소외계층을 배려하고 스스로 일어설 수 있도록 돕는 복지체계를 통해 국민 모두가 인간적 품위를 지키며 살아갈 수 있는 사회를 지향한다. 국민통합을 바탕으로 개방 지향적 국제화를 추구하며 지속가능한 사회를 만들기 위해 자유, 인권, 복지, 평화, 환경 등 보편적 가치를 추구한다.

서울경제신문은 정치권력, 자본권력, 특정 이익집단, 이념집단으로부터 독립성을 유지하고 불의, 불법, 타협하지 않는 정론직필의 전통을 이어간다. 이러한 사시를 바탕으로 저널리즘의 가치와 원칙을 지킨다.

특히, 제보, 취재, 보도, 논평 등 저널리즘 활동 전 과정에서 다음과 같은 가치와 원칙을 지킨다.`,
  },
];

// 프롬프트 템플릿 샘플
const TEMPLATE = `당신은 숙련된 한국어 교정 전문가입니다. 다음 텍스트를 맞춤법과 문법에 맞게 교정해주세요:

{{TEXT}}

교정 시 다음 원칙을 따라주세요:
1. 맞춤법과 문법 오류를 수정
2. 어색한 표현을 자연스럽게 개선
3. 문장 구조를 명확히 함
4. 올바른 문장 부호 사용

교정 결과:`;

// MongoDB 연결
async function connectToDatabase() {
  try {
    await mongoose.connect(config.MONGODB_URI);
    logger.info("MongoDB 연결 성공");
  } catch (error) {
    logger.error(`MongoDB 연결 오류: ${error.message}`);
    process.exit(1);
  }
}

// 사용자 입력 대기 함수
function waitForUserInput(message = "계속하려면 Enter 키를 누르세요...") {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(message, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

// 분리선 출력 함수
function printDivider(title) {
  const line = "=".repeat(80);
  console.log("\n" + line);
  if (title) console.log(`${title}`);
  console.log(line + "\n");
}

// 검색 결과 포맷팅 함수
function formatSearchResults(results) {
  if (!results) return "결과 없음";

  // 배열 결과인 경우
  if (Array.isArray(results)) {
    if (results.length === 0) return "결과 없음";

    return results
      .map((guide, index) => {
        const score = guide.score
          ? `(유사도: ${(guide.score * 100).toFixed(1)}%)`
          : "";
        const docType = guide.doc_type ? `[${guide.doc_type}]` : "";
        return `${index + 1}. ${docType} ${
          guide.section || "제목 없음"
        } ${score}\n   ${guide.content?.substring(0, 100)}...`;
      })
      .join("\n\n");
  }

  // 계층적 결과인 경우
  if (results.documents) {
    const docs = formatSearchResults(results.documents);
    const chunks =
      results.chunks?.length > 0
        ? "\n\n--- 관련 청크 ---\n" + formatSearchResults(results.chunks)
        : "";

    return docs + chunks;
  }

  // 카테고리 결과인 경우
  if (results.categories) {
    let output = "";
    for (const [category, guides] of Object.entries(results.categories)) {
      output += `\n--- 카테고리: ${category} ---\n`;
      output += formatSearchResults(guides);
    }
    return output;
  }

  return "알 수 없는 결과 형식";
}

// 1. 기본 RAG 검색 테스트
async function testBasicSearch() {
  printDivider("1. 기본 RAG 검색 테스트");

  for (const query of TEST_QUERIES) {
    console.log(`쿼리: "${query.name}"`);

    const results = await ragService.findRelevantGuides(query.text, {
      limit: 3,
      minScore: 0.6,
    });

    console.log("\n검색 결과:");
    console.log(formatSearchResults(results));

    await waitForUserInput();
  }
}

// 2. 계층적 검색 테스트
async function testHierarchicalSearch() {
  printDivider("2. 계층적 검색 테스트");

  // 긴 텍스트에 대해 계층적 검색이 더 효과적
  const query = TEST_QUERIES[2];
  console.log(`쿼리: "${query.name}"`);

  // 임베딩 생성
  const embedding =
    await require("./src/services/rag/embeddingProvider").createEmbedding(
      query.text
    );

  // 계층적 검색 실행
  const hierarchicalResults = await vectorSearch.findHierarchical(embedding, {
    limit: 3,
    minScore: 0.6,
    includeChunks: true,
  });

  console.log("\n계층적 검색 결과:");
  console.log(formatSearchResults(hierarchicalResults));

  await waitForUserInput();
}

// 3. 문서 유형 기반 검색 테스트
async function testDocTypeSearch() {
  printDivider("3. 문서 유형 기반 검색 테스트");

  const query = TEST_QUERIES[1];
  console.log(`쿼리: "${query.name}"`);

  // 임베딩 생성
  const embedding =
    await require("./src/services/rag/embeddingProvider").createEmbedding(
      query.text
    );

  // 각 문서 유형별로 검색 실행
  const docTypes = ["rule", "guideline", "case"];

  for (const docType of docTypes) {
    const results = await vectorSearch.findByDocType(embedding, docType, {
      limit: 3,
      minScore: 0.6,
    });

    console.log(`\n문서 유형 [${docType}] 검색 결과:`);
    console.log(formatSearchResults(results));

    await waitForUserInput();
  }
}

// 4. 카테고리 기반 검색 테스트
async function testCategorySearch() {
  printDivider("4. 카테고리 기반 검색 테스트");

  const query = TEST_QUERIES[1];
  console.log(`쿼리: "${query.name}"`);

  // 임베딩 생성
  const embedding =
    await require("./src/services/rag/embeddingProvider").createEmbedding(
      query.text
    );

  // 카테고리 기반 검색 실행
  const categoryResults = await vectorSearch.findByCategory(embedding, {
    limit: 10,
    minScore: 0.6,
    includeChunks: false,
  });

  console.log("\n카테고리 기반 검색 결과:");
  console.log(formatSearchResults(categoryResults));

  await waitForUserInput();
}

// 5. 프롬프트 강화 테스트
async function testPromptEnhancement() {
  printDivider("5. 프롬프트 강화 테스트");

  const query = TEST_QUERIES[1];
  console.log(`쿼리: "${query.name}"`);

  // 기본 프롬프트
  console.log("\n기본 프롬프트:");
  const basicPrompt = TEMPLATE.replace("{{TEXT}}", query.text);
  console.log(basicPrompt);

  // RAG로 강화된 프롬프트
  console.log("\nRAG로 강화된 프롬프트:");
  const enhancedPrompt = await ragService.enhancePromptWithRAG(
    basicPrompt,
    query.text,
    {
      limit: 3,
      minScore: 0.6,
      maxTokens: 1000,
    }
  );

  console.log(enhancedPrompt);

  await waitForUserInput();
}

// 6. API 통합 테스트 (서버가 실행 중인 경우)
async function testAPI() {
  printDivider("6. API 통합 테스트 (서버가 실행 중인 경우)");

  const serverRunning = await checkServerRunning();
  if (!serverRunning) {
    console.log("서버가 실행 중이지 않습니다. API 테스트를 건너뜁니다.");
    return;
  }

  const query = TEST_QUERIES[1];
  console.log(`쿼리: "${query.name}"`);

  try {
    // RAG를 사용한 교정 요청
    const response = await axios.post(
      "http://localhost:3000/api/quick-proofread",
      {
        text: query.text,
        userId: "test-user",
        options: {
          useRag: true,
          useHierarchical: true,
        },
      }
    );

    console.log("\n교정 결과:");
    console.log(`원문: ${query.text.substring(0, 100)}...`);
    console.log(
      `\n최소 교정: ${response.data.corrections[0].correctedText.substring(
        0,
        100
      )}...`
    );
    console.log(
      `\n적극적 교정: ${response.data.corrections[1].correctedText.substring(
        0,
        100
      )}...`
    );
  } catch (error) {
    console.log("API 테스트 오류:", error.message);
  }

  await waitForUserInput();
}

// 서버 실행 확인 함수
async function checkServerRunning() {
  try {
    await axios.get("http://localhost:3000/api/health");
    return true;
  } catch (error) {
    return false;
  }
}

// 메인 함수
async function main() {
  try {
    // MongoDB 연결
    await connectToDatabase();

    printDivider("RAG 시스템 테스트 시작");
    console.log(
      `Chroma DB 사용 여부: ${
        process.env.USE_CHROMA === "true" ? "예" : "아니요"
      }`
    );
    console.log(
      `RAG 기능 사용 여부: ${process.env.USE_RAG !== "false" ? "예" : "아니요"}`
    );

    // 각 테스트 실행
    await testBasicSearch();
    await testHierarchicalSearch();
    await testDocTypeSearch();
    await testCategorySearch();
    await testPromptEnhancement();
    await testAPI();

    printDivider("모든 테스트 완료");
  } catch (error) {
    console.error("테스트 실행 중 오류 발생:", error);
  } finally {
    // 연결 종료
    await mongoose.connection.close();
    console.log("MongoDB 연결 종료");
    process.exit(0);
  }
}

// 스크립트 실행
main();
