/**
 * 기사(교열 요청) 모델
 */

const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const ArticleSchema = new Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    originalText: {
      type: String,
      required: true,
    },
    topic: {
      type: String,
      default: "일반",
    },
    category: {
      type: String,
      default: "기타",
    },
    metadata: {
      type: Map,
      of: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: {
      createdAt: "createdAt",
      updatedAt: "updatedAt",
    },
  }
);

// 텍스트 길이가 너무 길 경우 요약된 버전 제공
ArticleSchema.methods.getSummary = function () {
  const maxLength = 100;
  if (this.originalText.length <= maxLength) {
    return this.originalText;
  }
  return this.originalText.slice(0, maxLength) + "...";
};

module.exports = mongoose.model("Article", ArticleSchema);
