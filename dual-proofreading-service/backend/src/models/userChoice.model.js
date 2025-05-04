/**
 * 사용자 선택 모델
 */

const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const UserChoiceSchema = new Schema(
  {
    articleId: {
      type: Schema.Types.ObjectId,
      ref: "Article",
      required: true,
      index: true,
    },
    selectedPromptType: {
      type: Number,
      required: true,
      enum: [1, 2], // 1: 최소한 교열, 2: 적극적 교열
      index: true,
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      default: null,
    },
    comment: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: {
      createdAt: "createdAt",
      updatedAt: "updatedAt",
    },
  }
);

// 가상 필드: 피드백 여부
UserChoiceSchema.virtual("hasFeedback").get(function () {
  return this.rating !== null || this.comment.trim().length > 0;
});

// 피드백 요약 제공
UserChoiceSchema.methods.getFeedbackSummary = function () {
  const hasFeedback = this.rating !== null || this.comment.trim().length > 0;

  return {
    hasFeedback,
    rating: this.rating,
    hasComment: this.comment.trim().length > 0,
  };
};

module.exports = mongoose.model("UserChoice", UserChoiceSchema);
