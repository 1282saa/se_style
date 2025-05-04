const mongoose = require("mongoose");
const Schema = mongoose.Schema;

/**
 * 교정 결과 스키마
 */
const ProofreadingSchema = new Schema(
  {
    // 교정된 글 ID
    articleId: {
      type: Schema.Types.ObjectId,
      ref: "Article",
      required: true,
    },

    // 교정 요청 사용자 ID
    userId: {
      type: String,
      required: true,
      index: true,
    },

    // 교정 유형 (minimal, active)
    type: {
      type: String,
      enum: ["minimal", "active"],
      default: "minimal",
    },

    // 원본 텍스트
    originalText: {
      type: String,
      required: true,
    },

    // 교정된 텍스트
    correctedText: {
      type: String,
      required: true,
    },

    // 교정 사항 목록
    corrections: [
      {
        // 교정 유형
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
          required: true,
        },

        // 원본 텍스트 위치 (시작)
        startIndex: {
          type: Number,
          required: true,
        },

        // 원본 텍스트 위치 (종료)
        endIndex: {
          type: Number,
          required: true,
        },

        // 원본 텍스트
        originalText: {
          type: String,
          required: true,
        },

        // 교정된 텍스트
        correctedText: {
          type: String,
          required: true,
        },

        // 교정 설명
        explanation: {
          type: String,
          required: true,
        },

        // 참조된 스타일 가이드 ID
        styleGuideRef: {
          type: Schema.Types.ObjectId,
          ref: "StyleGuide",
        },
      },
    ],

    // 메타데이터
    metadata: {
      type: Object,
      default: {},
    },

    // 생성 시간 및 상태
    status: {
      type: String,
      enum: ["pending", "completed", "failed"],
      default: "completed",
    },

    // 처리 시간 (밀리초)
    processingTime: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true, // createdAt, updatedAt 자동 생성
  }
);

// 인덱스 생성
ProofreadingSchema.index({ articleId: 1, type: 1 });
ProofreadingSchema.index({ userId: 1, createdAt: -1 });
ProofreadingSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Proofreading", ProofreadingSchema);
