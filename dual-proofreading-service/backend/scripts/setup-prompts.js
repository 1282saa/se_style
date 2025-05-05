/**
 * 프롬프트 템플릿 초기 데이터 설정 스크립트
 *
 * 실행 방법: node scripts/setup-prompts.js
 */

const mongoose = require("mongoose");
const config = require("../src/config");
const logger = require("../src/utils/logger");

// MongoDB 연결
mongoose
  .connect(config.MONGODB_URI)
  .then(() => {
    logger.info("MongoDB 연결 성공");
    initializePrompts();
  })
  .catch((err) => {
    logger.error(`MongoDB 연결 오류: ${err.message}`);
    process.exit(1);
  });

// 프롬프트 모델 정의
const PromptSchema = new mongoose.Schema({
  prompt_id: { type: String, required: true, unique: true, index: true },
  type: { type: String, required: true, index: true },
  level: { type: String, required: true, index: true },
  template: {
    prefix: { type: String, required: true },
    suffix: { type: String, required: true },
  },
  tags: [{ type: String }],
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const Prompt = mongoose.models.Prompt || mongoose.model("Prompt", PromptSchema);

// 초기 프롬프트 데이터
const promptData = [
  {
    prompt_id: "proofread-minimal",
    type: "correction",
    level: "minimal",
    template: {
      prefix:
        "당신은 전문 한국어 교정 편집자입니다. 다음 텍스트를 최소한의 필수적인 수정만 가하여 교정해 주세요.\n\n기본 맞춤법, 띄어쓰기, 문법 오류만 수정하고, 원문의 스타일과 어휘 선택은 최대한 유지하세요.\n\n다음 규칙과 지침을 참고하세요:\n\n{{KNOWLEDGE_RULES}}\n\n{{STYLE_GUIDES}}\n\n### 원문:\n{{ORIGINAL_TEXT}}",
      suffix:
        '\n\n### 출력 형식:\n```json\n{\n  "correctedText": "교정된 텍스트",\n  "corrections": [\n    {\n      "type": "교정 유형(spelling, grammar, style, punctuation, flow, foreign, other 중 하나)",\n      "original": "원본 텍스트",\n      "suggestion": "교정된 텍스트",\n      "explanation": "교정 이유 설명"\n    }\n  ]\n}\n```',
    },
    tags: ["grammar", "minimal"],
    isActive: true,
  },
  {
    prompt_id: "proofread-enhanced",
    type: "correction",
    level: "enhanced",
    template: {
      prefix:
        "당신은 전문 한국어 교정 편집자입니다. 다음 텍스트를 포괄적으로 개선해 주세요.\n\n기본적인 맞춤법, 띄어쓰기, 문법 오류 수정은 물론, 더 명확하고 세련된 표현으로 개선하세요.\n문장 구조를 더 읽기 쉽게 재구성하고, 적절한 어휘로 대체하며, 논리적 흐름을 개선하세요.\n불필요한 반복은 제거하고, 전문적이고 세련된 문체로 변환해 주세요.\n\n다음 규칙과 지침을 참고하세요:\n\n{{KNOWLEDGE_RULES}}\n\n{{STYLE_GUIDES}}\n\n### 원문:\n{{ORIGINAL_TEXT}}",
      suffix:
        '\n\n### 출력 형식:\n```json\n{\n  "correctedText": "교정된 텍스트",\n  "corrections": [\n    {\n      "type": "교정 유형(spelling, grammar, style, punctuation, flow, foreign, other 중 하나)",\n      "original": "원본 텍스트",\n      "suggestion": "교정된 텍스트",\n      "explanation": "교정 이유 설명"\n    }\n  ]\n}\n```',
    },
    tags: ["grammar", "style", "flow", "enhanced"],
    isActive: true,
  },
  {
    prompt_id: "proofread-custom",
    type: "correction",
    level: "custom",
    template: {
      prefix:
        "당신은 전문 한국어 교정 편집자입니다. 다음 텍스트를 사용자가 지정한 방식으로 교정해 주세요.\n\n{{USER_PREFERENCES}}\n\n다음 규칙과 지침을 참고하세요:\n\n{{KNOWLEDGE_RULES}}\n\n{{STYLE_GUIDES}}\n\n### 원문:\n{{ORIGINAL_TEXT}}",
      suffix:
        '\n\n### 출력 형식:\n```json\n{\n  "correctedText": "교정된 텍스트",\n  "corrections": [\n    {\n      "type": "교정 유형(spelling, grammar, style, punctuation, flow, foreign, other 중 하나)",\n      "original": "원본 텍스트",\n      "suggestion": "교정된 텍스트",\n      "explanation": "교정 이유 설명"\n    }\n  ]\n}\n```',
    },
    tags: ["custom"],
    isActive: true,
  },
];

// 프롬프트 데이터 초기화 함수
async function initializePrompts() {
  try {
    // 기존 데이터 확인
    const existingCount = await Prompt.countDocuments();
    logger.info(`기존 프롬프트 데이터: ${existingCount}개`);

    // 각 프롬프트 데이터 처리
    for (const prompt of promptData) {
      // 기존 데이터가 있으면 업데이트, 없으면 생성
      const result = await Prompt.findOneAndUpdate(
        { prompt_id: prompt.prompt_id },
        prompt,
        { upsert: true, new: true }
      );

      logger.info(
        `프롬프트 설정 완료: ${prompt.prompt_id} (${
          result.isActive ? "활성" : "비활성"
        })`
      );
    }

    logger.info("모든 프롬프트 템플릿 설정 완료");
    mongoose.disconnect();
  } catch (error) {
    logger.error(`프롬프트 초기화 오류: ${error.message}`);
    mongoose.disconnect();
    process.exit(1);
  }
}
