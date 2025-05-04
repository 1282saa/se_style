/**
 * 교열 결과 모델
 */

const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const CorrectionSchema = new Schema(
  {
    articleId: {
      type: Schema.Types.ObjectId,
      ref: "Article",
      required: true,
      index: true,
    },
    promptType: {
      type: Number,
      required: true,
      enum: [1, 2], // 1: 최소한 교열, 2: 적극적 교열
      index: true,
    },
    correctedText: {
      type: String,
      required: true,
    },
    changes: [
      {
        ruleId: {
          type: String,
        },
        original: {
          type: String,
        },
        suggestion: {
          type: String,
        },
        explanation: {
          type: String,
        },
        priority: {
          type: Number,
          enum: [1, 2, 3, 4, 5], // 1: 지식, 2: 참고, 3: 제안, 4: 권고, 5: 필수
        },
        confidence: {
          type: Number,
          min: 0,
          max: 1,
        },
      },
    ],
    llmInfo: {
      model: {
        type: String,
        required: true,
      },
      version: {
        type: String,
      },
      promptTokens: {
        type: Number,
      },
      completionTokens: {
        type: Number,
      },
      totalTokens: {
        type: Number,
      },
    },
  },
  {
    timestamps: {
      createdAt: "createdAt",
      updatedAt: "updatedAt",
    },
  }
);

// 변경 사항 요약 제공
CorrectionSchema.methods.getChangesSummary = function () {
  return {
    total: this.changes.length,
    byPriority: {
      필수: this.changes.filter((c) => c.priority === 5).length,
      권고: this.changes.filter((c) => c.priority === 4).length,
      제안: this.changes.filter((c) => c.priority === 3).length,
      참고: this.changes.filter((c) => c.priority === 2).length,
      지식: this.changes.filter((c) => c.priority === 1).length,
    },
  };
};

module.exports = mongoose.model("Correction", CorrectionSchema);
