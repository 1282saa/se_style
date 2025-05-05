/**
 * 교열 지식 기반 초기 데이터 설정 스크립트
 *
 * 실행 방법: node scripts/setup-knowledge.js
 */

const mongoose = require("mongoose");
const config = require("../src/config");
const logger = require("../src/utils/logger");
const embeddingProvider = require("../src/services/rag/embeddingProvider");

// MongoDB 연결
mongoose
  .connect(config.MONGODB_URI)
  .then(() => {
    logger.info("MongoDB 연결 성공");
    initializeKnowledgeBase();
  })
  .catch((err) => {
    logger.error(`MongoDB 연결 오류: ${err.message}`);
    process.exit(1);
  });

// Knowledge 모델 정의
const KnowledgeSchema = new mongoose.Schema(
  {
    sourceFile: {
      type: String,
      required: true,
      description: "원본 XML 파일명",
    },
    type: {
      type: String,
      required: true,
      index: true,
      description: "규칙 유형 (맞춤법, 문법, 표현 등)",
    },
    category: {
      type: String,
      required: true,
      index: true,
      description: "규칙 카테고리",
    },
    rule: {
      type: String,
      required: true,
      description: "규칙 내용",
    },
    explanation: {
      type: String,
      description: "규칙에 대한 부가 설명",
    },
    examples: [
      {
        incorrect: { type: String, description: "잘못된 예시" },
        correct: { type: String, description: "올바른 예시" },
        explanation: { type: String, description: "예시 설명" },
      },
    ],
    priority: {
      type: Number,
      default: 3,
      min: 1,
      max: 5,
      description: "우선순위 (1: 낮음 ~ 5: 높음)",
    },
    tags: [
      {
        type: String,
        description: "규칙 관련 태그",
      },
    ],
    vector: {
      type: [Number],
      select: false,
      description: "임베딩 벡터 (기본적으로 쿼리에서 제외)",
    },
  },
  {
    timestamps: true,
  }
);

const Knowledge =
  mongoose.models.Knowledge || mongoose.model("Knowledge", KnowledgeSchema);

// 초기 지식 데이터
const knowledgeData = [
  {
    sourceFile: "default-rules.xml",
    type: "맞춤법",
    category: "띄어쓰기",
    rule: "조사는 앞말에 붙여 쓴다.",
    explanation: "조사(~은/는, ~이/가, ~을/를 등)는 앞말에 붙여 써야 합니다.",
    examples: [
      {
        incorrect: "사과 가 맛있다.",
        correct: "사과가 맛있다.",
        explanation: "조사 '가'는 앞말 '사과'에 붙여 써야 합니다.",
      },
      {
        incorrect: "나 는 학생이다.",
        correct: "나는 학생이다.",
        explanation: "조사 '는'은 앞말 '나'에 붙여 써야 합니다.",
      },
    ],
    priority: 5,
    tags: ["띄어쓰기", "조사"],
  },
  {
    sourceFile: "default-rules.xml",
    type: "맞춤법",
    category: "띄어쓰기",
    rule: "의존 명사는 띄어 쓴다.",
    explanation: "의존 명사(~것, ~수, ~바 등)는 앞말과 띄어 써야 합니다.",
    examples: [
      {
        incorrect: "먹을것이 없다.",
        correct: "먹을 것이 없다.",
        explanation: "의존 명사 '것'은 앞말과 띄어 써야 합니다.",
      },
      {
        incorrect: "갈수 있다.",
        correct: "갈 수 있다.",
        explanation: "의존 명사 '수'는 앞말과 띄어 써야 합니다.",
      },
    ],
    priority: 4,
    tags: ["띄어쓰기", "의존 명사"],
  },
  {
    sourceFile: "default-rules.xml",
    type: "문법",
    category: "문장 성분",
    rule: "주어와 서술어는 호응해야 한다.",
    explanation: "문장의 주어와 서술어는 의미적으로 호응해야 합니다.",
    examples: [
      {
        incorrect: "나는 학교에 갔습니까?",
        correct: "나는 학교에 갔습니다.",
        explanation:
          "1인칭 주어 '나'와 의문형 종결어미 '~ㅂ니까'는 호응하지 않습니다.",
      },
      {
        incorrect: "그 사람은 책을 읽었다.",
        correct: "그 사람은 책을 읽었다.",
        explanation: "올바른 예시입니다.",
      },
    ],
    priority: 5,
    tags: ["문법", "호응"],
  },
  {
    sourceFile: "default-rules.xml",
    type: "표현",
    category: "중복 표현",
    rule: "불필요한 중복 표현을 피한다.",
    explanation: "의미가 중복되는 표현은 피해야 합니다.",
    examples: [
      {
        incorrect: "가장 최고의 제품",
        correct: "최고의 제품",
        explanation: "'가장'과 '최고'는 의미가 중복됩니다.",
      },
      {
        incorrect: "미리 예습하다",
        correct: "예습하다",
        explanation: "'미리'는 '예습'에 이미 포함된 의미입니다.",
      },
    ],
    priority: 3,
    tags: ["표현", "중복"],
  },
  {
    sourceFile: "default-rules.xml",
    type: "표현",
    category: "외래어",
    rule: "외래어는 한글 표기법에 맞게 적는다.",
    explanation: "외래어는 국립국어원의 외래어 표기법에 따라 적어야 합니다.",
    examples: [
      {
        incorrect: "컴퓨터 파일 다운로드",
        correct: "컴퓨터 파일 내려받기",
        explanation: "가능한 한 우리말로 바꿔 쓰는 것이 좋습니다.",
      },
      {
        incorrect: "웹사이트",
        correct: "웹 사이트",
        explanation: "'웹'과 '사이트'는 띄어 써야 합니다.",
      },
    ],
    priority: 3,
    tags: ["외래어", "표기법"],
  },
];

// 벡터 생성 함수
async function generateEmbedding(text) {
  try {
    if (!text) return null;

    // 벡터 생성
    const embeddings = await embeddingProvider.createEmbedding(text);
    return embeddings;
  } catch (error) {
    logger.error(`임베딩 생성 오류: ${error.message}`);
    return null;
  }
}

// 지식 데이터에 벡터 추가
async function addVectorsToKnowledge(items) {
  const itemsWithVectors = [];

  for (const item of items) {
    // 임베딩 생성을 위한 텍스트 준비
    const embeddingText = `${item.rule} ${
      item.explanation || ""
    } ${item.examples
      .map(
        (e) => `${e.incorrect || ""} ${e.correct || ""} ${e.explanation || ""}`
      )
      .join(" ")}`;

    try {
      // 벡터 생성
      const vector = await generateEmbedding(embeddingText);

      if (vector) {
        itemsWithVectors.push({
          ...item,
          vector,
        });
        logger.info(`규칙 "${item.rule.substring(0, 30)}..." 벡터 생성 완료`);
      } else {
        itemsWithVectors.push(item);
        logger.warn(`규칙 "${item.rule.substring(0, 30)}..." 벡터 생성 실패`);
      }
    } catch (error) {
      logger.error(`벡터 생성 오류: ${error.message}`);
      itemsWithVectors.push(item);
    }
  }

  return itemsWithVectors;
}

// 지식 데이터 초기화 함수
async function initializeKnowledgeBase() {
  try {
    // 기존 데이터 확인
    const existingCount = await Knowledge.countDocuments();
    logger.info(`기존 지식 데이터: ${existingCount}개`);

    // 벡터 추가
    const dataWithVectors = await addVectorsToKnowledge(knowledgeData);

    // 각 지식 데이터 처리
    for (const item of dataWithVectors) {
      // 기존 데이터가 있는지 확인
      const existing = await Knowledge.findOne({
        type: item.type,
        category: item.category,
        rule: item.rule,
      });

      if (existing) {
        // 기존 데이터 업데이트
        await Knowledge.updateOne({ _id: existing._id }, { $set: item });
        logger.info(`규칙 업데이트: "${item.rule.substring(0, 30)}..."`);
      } else {
        // 새 데이터 추가
        await Knowledge.create(item);
        logger.info(`규칙 추가: "${item.rule.substring(0, 30)}..."`);
      }
    }

    logger.info("모든 지식 데이터 설정 완료");
    mongoose.disconnect();
  } catch (error) {
    logger.error(`지식 데이터 초기화 오류: ${error.message}`);
    mongoose.disconnect();
    process.exit(1);
  }
}
