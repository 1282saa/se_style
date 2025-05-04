/**
 * 기사(교열 요청) 모델
 * @module models/article
 */

const mongoose = require("mongoose");
const Schema = mongoose.Schema;

/**
 * 기사 스키마
 * @typedef {Object} Article
 * @property {string} userId - 사용자 ID
 * @property {string} originalText - 원본 텍스트
 * @property {string} topic - 주제
 * @property {string} category - 카테고리
 * @property {Object} metadata - 메타데이터
 * @property {Date} createdAt - 생성일
 * @property {Date} updatedAt - 수정일
 */
const ArticleSchema = new Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
      description: "사용자 ID (익명 사용자의 경우 'anonymous')",
    },
    originalText: {
      type: String,
      required: true,
      description: "교정 대상 원문 텍스트",
      maxlength: [100000, "텍스트는 10만 자를 초과할 수 없습니다"], // 최대 길이 제한 추가
    },
    topic: {
      type: String,
      default: "일반",
      description: "기사 주제",
      trim: true, // 공백 자동 제거
    },
    category: {
      type: String,
      default: "기타",
      description: "기사 카테고리",
      trim: true, // 공백 자동 제거
    },
    metadata: {
      type: Map,
      of: Schema.Types.Mixed,
      default: {},
      description: "추가 메타데이터",
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
 * 텍스트 요약 메서드
 * @function getSummary
 * @memberof Article
 * @param {number} maxLength - 최대 요약 길이 (기본값: 100)
 * @returns {string} 요약된 텍스트 또는 원문 전체
 */
ArticleSchema.methods.getSummary = function (maxLength = 100) {
  if (!this.originalText) return "";
  if (this.originalText.length <= maxLength) {
    return this.originalText;
  }
  return this.originalText.slice(0, maxLength) + "...";
};

/**
 * 글자 수 계산 가상 필드
 */
ArticleSchema.virtual("textLength").get(function () {
  return this.originalText ? this.originalText.length : 0;
});

/**
 * 단어 수 계산 가상 필드
 */
ArticleSchema.virtual("wordCount").get(function () {
  if (!this.originalText) return 0;
  const words = this.originalText.trim().split(/\s+/);
  return words.length;
});

/**
 * 문장 수 계산 가상 필드
 */
ArticleSchema.virtual("sentenceCount").get(function () {
  if (!this.originalText) return 0;
  // 문장 구분자로 나누기 (마침표, 느낌표, 물음표 + 공백 또는 줄바꿈)
  const sentences = this.originalText.split(/[.!?][\s\n]/);
  return sentences.length;
});

// 교정 결과 가상 필드 (필요 시 나중에 populate)
ArticleSchema.virtual("corrections", {
  ref: "Correction",
  localField: "_id",
  foreignField: "articleId",
});

// 사용자 선택 가상 필드
ArticleSchema.virtual("userChoice", {
  ref: "UserChoice",
  localField: "_id",
  foreignField: "articleId",
  justOne: true,
});

// 프로세싱 작업 가상 필드
ArticleSchema.virtual("proofreading", {
  ref: "Proofreading",
  localField: "_id",
  foreignField: "articleId",
  justOne: true,
});

// 인덱스 생성
ArticleSchema.index({ createdAt: -1 });
ArticleSchema.index({ userId: 1, createdAt: -1 });
ArticleSchema.index({ topic: 1, category: 1 }); // 주제 및 카테고리로 검색 인덱스 추가

/**
 * 기사 생성 전 검증
 */
ArticleSchema.pre("save", function (next) {
  // 텍스트가 빈 값이면 오류 발생
  if (!this.originalText || this.originalText.trim().length === 0) {
    next(new Error("원문 텍스트는 빈 값일 수 없습니다"));
    return;
  }

  // userId가 없으면 익명으로 설정
  if (!this.userId) {
    this.userId = "anonymous";
  }

  next();
});

module.exports = mongoose.model("Article", ArticleSchema);
