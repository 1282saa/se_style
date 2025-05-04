/**
 * 교열 결과 모델
 * @module models/correction
 */

const mongoose = require("mongoose");
const Schema = mongoose.Schema;

/**
 * 변경사항 스키마
 * @typedef {Object} Change
 * @property {string} ruleId - 적용된 규칙 ID
 * @property {string} original - 원본 텍스트
 * @property {string} suggestion - 제안된 텍스트
 * @property {string} explanation - 변경 이유 설명
 * @property {number} priority - 중요도 (1: 지식, 2: 참고, 3: 제안, 4: 권고, 5: 필수)
 * @property {number} confidence - 신뢰도 (0~1)
 */
const ChangeSchema = new Schema({
  ruleId: {
    type: String,
    description: "적용된 스타일 가이드 규칙 ID",
  },
  original: {
    type: String,
    description: "원본 텍스트",
    required: true,
  },
  suggestion: {
    type: String,
    description: "제안된 텍스트",
    required: true,
  },
  explanation: {
    type: String,
    description: "변경 이유 설명",
  },
  priority: {
    type: Number,
    enum: [1, 2, 3, 4, 5], // 1: 지식, 2: 참고, 3: 제안, 4: 권고, 5: 필수
    default: 3,
    description: "변경 중요도",
  },
  confidence: {
    type: Number,
    min: 0,
    max: 1,
    default: 0.8,
    description: "변경 신뢰도 (0~1)",
  },
  type: {
    type: String,
    enum: [
      "spelling",
      "grammar",
      "style",
      "punctuation",
      "flow",
      "foreign",
      "other",
    ],
    default: "other",
    description: "교정 유형",
  },
});

/**
 * LLM 정보 스키마
 * @typedef {Object} LLMInfo
 * @property {string} model - 사용된 LLM 모델
 * @property {string} version - 모델 버전
 * @property {number} promptTokens - 프롬프트 토큰 수
 * @property {number} completionTokens - 완성 토큰 수
 * @property {number} totalTokens - 총 토큰 수
 */
const LLMInfoSchema = new Schema({
  model: {
    type: String,
    required: true,
    description: "사용된 LLM 모델명",
  },
  version: {
    type: String,
    description: "모델 버전",
  },
  promptTokens: {
    type: Number,
    description: "입력 토큰 수",
    min: 0,
  },
  completionTokens: {
    type: Number,
    description: "출력 토큰 수",
    min: 0,
  },
  totalTokens: {
    type: Number,
    description: "총 사용 토큰 수",
    min: 0,
  },
});

/**
 * 교정 결과 스키마
 * @typedef {Object} Correction
 * @property {ObjectId} articleId - 기사 ID
 * @property {number} promptType - 프롬프트 유형 (1: 최소한 교열, 2: 적극적 교열, 3: 맞춤형 교열)
 * @property {string} correctedText - 교정된 텍스트
 * @property {Array<Change>} changes - 변경 사항 목록
 * @property {LLMInfo} llmInfo - LLM 정보
 * @property {Date} createdAt - 생성일
 * @property {Date} updatedAt - 수정일
 */
const CorrectionSchema = new Schema(
  {
    articleId: {
      type: Schema.Types.ObjectId,
      ref: "Article",
      required: true,
      index: true,
      description: "교정된 기사 ID",
    },
    promptType: {
      type: Number,
      required: true,
      enum: [1, 2, 3], // 1: 최소한 교열, 2: 적극적 교열, 3: 맞춤형 교열
      index: true,
      description: "사용된 프롬프트 유형",
    },
    correctedText: {
      type: String,
      required: true,
      description: "교정된 텍스트",
    },
    changes: [ChangeSchema], // 스키마 참조로 변경
    llmInfo: {
      type: LLMInfoSchema, // 스키마 참조로 변경
      required: true,
      _id: false, // 서브도큐먼트 ID 비활성화
    },
    preferences: {
      type: Map,
      of: Schema.Types.Mixed,
      default: {},
      description: "맞춤형 교정(promptType=3)에 사용된 선호도 설정",
    },
  },
  {
    timestamps: {
      createdAt: "createdAt",
      updatedAt: "updatedAt",
    },
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

/**
 * 변경 사항 요약 제공
 * @function getChangesSummary
 * @memberof Correction
 * @returns {Object} 변경 사항 요약 정보
 */
CorrectionSchema.methods.getChangesSummary = function () {
  if (!this.changes || this.changes.length === 0) {
    return {
      total: 0,
      byPriority: { 필수: 0, 권고: 0, 제안: 0, 참고: 0, 지식: 0 },
      byType: {},
    };
  }

  // 유형별 분류 추가
  const byType = {};
  this.changes.forEach((change) => {
    const type = change.type || "other";
    byType[type] = (byType[type] || 0) + 1;
  });

  return {
    total: this.changes.length,
    byPriority: {
      필수: this.changes.filter((c) => c.priority === 5).length,
      권고: this.changes.filter((c) => c.priority === 4).length,
      제안: this.changes.filter((c) => c.priority === 3).length,
      참고: this.changes.filter((c) => c.priority === 2).length,
      지식: this.changes.filter((c) => c.priority === 1).length,
    },
    byType,
  };
};

/**
 * 원문과 변경 비율 계산
 * @function getDiffRatio
 * @memberof Correction
 * @param {string} originalText - 원본 텍스트
 * @returns {number} 변경 비율 (0~1)
 */
CorrectionSchema.methods.getDiffRatio = function (originalText) {
  if (!originalText || originalText.length === 0 || !this.correctedText)
    return 0;

  // 간단한 문자 단위 차이 계산 (실제로는 더 정교한 알고리즘 사용 권장)
  let diffCount = 0;
  const minLength = Math.min(originalText.length, this.correctedText.length);
  const maxLength = Math.max(originalText.length, this.correctedText.length);

  for (let i = 0; i < minLength; i++) {
    if (originalText[i] !== this.correctedText[i]) {
      diffCount++;
    }
  }

  // 길이 차이도 고려
  diffCount += maxLength - minLength;

  return diffCount / maxLength;
};

/**
 * 교정 결과 요약 제공
 * @function getSummary
 * @memberof Correction
 * @returns {Object} 교정 결과 요약 정보
 */
CorrectionSchema.methods.getSummary = function () {
  return {
    id: this._id,
    articleId: this.articleId,
    promptType: this.promptType,
    promptTypeName:
      this.promptType === 1
        ? "최소 교정"
        : this.promptType === 2
        ? "적극적 교정"
        : "맞춤형 교정",
    changesCount: this.changes ? this.changes.length : 0,
    model: this.llmInfo ? this.llmInfo.model : "unknown",
    createdAt: this.createdAt,
  };
};

/**
 * 텍스트 길이 가상 필드
 */
CorrectionSchema.virtual("textLength").get(function () {
  return this.correctedText ? this.correctedText.length : 0;
});

// 관계 정의 (가상 필드)
CorrectionSchema.virtual("article", {
  ref: "Article",
  localField: "articleId",
  foreignField: "_id",
  justOne: true,
});

// 색인 설정
CorrectionSchema.index({ articleId: 1, promptType: 1 }, { unique: true });
CorrectionSchema.index({ createdAt: -1 });
CorrectionSchema.index({ "llmInfo.model": 1 }); // 모델별 검색 용이하게

module.exports = mongoose.model("Correction", CorrectionSchema);
