/**
 * 교열 날리지 규칙 모델
 * @module models/knowledge
 */

const mongoose = require("mongoose");
const Schema = mongoose.Schema;

/**
 * 날리지 규칙 스키마
 * @typedef {Object} Knowledge
 * @property {string} sourceFile - 원본 파일명
 * @property {string} type - 규칙 유형
 * @property {string} category - 카테고리
 * @property {string} rule - 규칙 내용
 * @property {string} explanation - 부가 설명
 * @property {Array} examples - 예제 배열
 * @property {number} priority - 우선순위 (1-5)
 * @property {Array} tags - 태그 배열
 * @property {Array} vector - 임베딩 벡터
 */
const KnowledgeSchema = new Schema(
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
    timestamps: {
      createdAt: "createdAt",
      updatedAt: "updatedAt",
    },
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// 인덱스 생성
KnowledgeSchema.index({ category: 1, type: 1 });
KnowledgeSchema.index({ tags: 1 });
KnowledgeSchema.index({ rule: "text", explanation: "text" }); // 텍스트 검색용

/**
 * 규칙 요약 메서드
 * @function getSummary
 * @memberof Knowledge
 * @returns {Object} - 규칙 요약 정보
 */
KnowledgeSchema.methods.getSummary = function () {
  return {
    id: this._id,
    type: this.type,
    category: this.category,
    rule: this.rule.substring(0, 50) + (this.rule.length > 50 ? "..." : ""),
    priority: this.priority,
  };
};

module.exports = mongoose.model("Knowledge", KnowledgeSchema);
