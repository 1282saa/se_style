/**
 * 스타일북 모델
 */

const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const StyleguideSchema = new Schema(
  {
    section: {
      type: String,
      required: true,
      index: true,
    },
    content: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      required: true,
      index: true,
    },
    tags: {
      type: [String],
    },
    vector: {
      type: [Number],
      sparse: true,
      select: false, // 기본적으로 조회 시 제외
    },
    priority: {
      type: Number,
      enum: [1, 2, 3, 4, 5], // 1: 지식, 2: 참고, 3: 제안, 4: 권고, 5: 필수
      default: 3,
    },
    metadata: {
      type: Map,
      of: Schema.Types.Mixed,
      default: {},
    },
    version: {
      type: String,
      default: "1.0",
    },
    // 관계
    relatedGuides: [
      {
        type: Schema.Types.ObjectId,
        ref: "Styleguide",
      },
    ],
  },
  {
    timestamps: {
      createdAt: "createdAt",
      updatedAt: "updatedAt",
    },
  }
);

// 인덱스 설정
StyleguideSchema.index({ section: 1, category: 1 });
StyleguideSchema.index({ tags: 1 });
StyleguideSchema.index({ "metadata.ruleId": 1 }, { sparse: true });

// 벡터 검색 도우미 메서드 (MongoDB Atlas Vector Search 사용 시)
StyleguideSchema.statics.vectorSearch = async function (
  vectorQuery,
  limit = 5
) {
  try {
    // MongoDB Atlas Vector Search 쿼리
    const result = await this.aggregate([
      {
        $vectorSearch: {
          queryVector: vectorQuery,
          path: "vector",
          numCandidates: 100,
          limit: limit,
        },
      },
      {
        $project: {
          section: 1,
          content: 1,
          category: 1,
          tags: 1,
          priority: 1,
          version: 1,
          score: { $meta: "vectorSearchScore" },
        },
      },
    ]);

    return result;
  } catch (error) {
    console.error("Vector search error:", error);
    return [];
  }
};

module.exports = mongoose.model("Styleguide", StyleguideSchema);
