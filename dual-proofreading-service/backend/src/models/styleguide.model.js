/**
 * 스타일북 모델
 * @module models/styleguide
 */

const mongoose = require("mongoose");
const Schema = mongoose.Schema;

/**
 * 스타일 가이드 예제 스키마
 */
const ExampleSchema = new Schema({
  wrong: { type: String, required: false },
  correct: { type: String, required: false },
  explanation: { type: String, required: false },
});

/**
 * 스타일 가이드 스키마
 * @typedef {Object} Styleguide
 * @property {string} section - 섹션 이름
 * @property {string} content - 내용
 * @property {string} category - 카테고리
 * @property {Array<string>} tags - 태그
 * @property {Array<number>} vector - 임베딩 벡터
 * @property {number} priority - 우선순위 (1: 지식, 2: 참고, 3: 제안, 4: 권고, 5: 필수)
 * @property {Object} metadata - 메타데이터
 * @property {string} version - 버전
 * @property {Array<ObjectId>} relatedGuides - 관련 가이드 ID 목록
 * @property {Date} createdAt - 생성일
 * @property {Date} updatedAt - 수정일
 */
const StyleguideSchema = new Schema(
  {
    ruleId: { type: String, required: true, unique: true, index: true },
    section: {
      type: String,
      required: true,
      index: true,
      description: "스타일 가이드 섹션 이름",
      trim: true,
    },
    content: {
      type: String,
      required: true,
      description: "스타일 가이드 내용",
      trim: true,
    },
    category: {
      type: String,
      required: false,
      index: true,
      description: "스타일 가이드 카테고리",
      trim: true,
    },
    tags: [{ type: String, index: true }],
    examples: [ExampleSchema],
    vector: { type: [Number], select: false }, // 기본적으로 조회 제외
    priority: {
      type: Number,
      default: 3,
      min: 1,
      max: 5, // 1: 참고, 3: 중요, 5: 필수
    },
    metadata: {
      type: Map,
      of: Schema.Types.Mixed,
      default: {},
      description: "추가 메타데이터",
    },
    version: {
      type: String,
      default: "1.0",
      description: "스타일 가이드 버전",
    },
    // 관계
    relatedGuides: [
      {
        type: Schema.Types.ObjectId,
        ref: "Styleguide",
        description: "관련 스타일 가이드 ID 목록",
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
      description: "활성화 여부",
      index: true,
    },
    lastUsedAt: {
      type: Date,
      default: null,
      description: "마지막 사용 시간",
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// 인덱스 설정
StyleguideSchema.index({ section: 1, category: 1 });
StyleguideSchema.index({ tags: 1 });
StyleguideSchema.index({ "metadata.ruleId": 1 }, { sparse: true });
StyleguideSchema.index({ category: 1, priority: -1 });
StyleguideSchema.index({ isActive: 1, priority: -1 }); // 활성 상태 및 우선순위로 검색 용이하게
StyleguideSchema.index({ section: "text", content: "text", tags: "text" });

/**
 * 검색 스코어 가상 속성
 */
StyleguideSchema.virtual("score").get(function () {
  return this._score;
});

StyleguideSchema.set("toJSON", {
  virtuals: true,
  transform: function (doc, ret) {
    delete ret.vector; // 항상 벡터 필드 제외
    return ret;
  },
});

/**
 * 가이드 요약 생성
 * @function getSummary
 * @memberof Styleguide
 * @returns {Object} 가이드 요약 정보
 */
StyleguideSchema.methods.getSummary = function () {
  return {
    id: this._id,
    section: this.section,
    category: this.category,
    priority: this.priority,
    tags: this.tags || [],
    isActive: this.isActive,
    version: this.version,
  };
};

/**
 * 가이드를 비활성화합니다.
 * @function deactivate
 * @memberof Styleguide
 * @returns {Promise<Object>} 업데이트된 가이드
 */
StyleguideSchema.methods.deactivate = async function () {
  this.isActive = false;
  return await this.save();
};

/**
 * 가이드를 활성화합니다.
 * @function activate
 * @memberof Styleguide
 * @returns {Promise<Object>} 업데이트된 가이드
 */
StyleguideSchema.methods.activate = async function () {
  this.isActive = true;
  return await this.save();
};

/**
 * 마지막 사용 시간을 업데이트합니다.
 * @function updateLastUsed
 * @memberof Styleguide
 * @returns {Promise<Object>} 업데이트된 가이드
 */
StyleguideSchema.methods.updateLastUsed = async function () {
  this.lastUsedAt = new Date();
  return await this.save();
};

/**
 * 벡터 검색 도우미 메서드 (MongoDB Atlas Vector Search 사용 시)
 * @function vectorSearch
 * @memberof Styleguide
 * @static
 * @param {Array<number>} vectorQuery - 검색 벡터
 * @param {number} limit - 최대 결과 수
 * @param {Object} options - 추가 옵션
 * @returns {Promise<Array>} 검색 결과
 */
StyleguideSchema.statics.vectorSearch = async function (
  vectorQuery,
  limit = 5,
  options = {}
) {
  try {
    // 검색 옵션 설정
    const {
      numCandidates = 100,
      minScore = 0,
      includeVector = false,
      activeOnly = true,
      category = null,
    } = options;

    // 벡터 유효성 검사
    if (
      !vectorQuery ||
      !Array.isArray(vectorQuery) ||
      vectorQuery.length === 0
    ) {
      throw new Error("유효하지 않은 검색 벡터입니다.");
    }

    // 기본 프로젝션 설정
    const projection = {
      section: 1,
      content: 1,
      category: 1,
      tags: 1,
      priority: 1,
      version: 1,
      score: { $meta: "vectorSearchScore" },
    };

    // 벡터 포함 여부 설정
    if (includeVector) {
      projection.vector = 1;
    }

    // 활성 상태 필터링을 위한 매치 조건
    const matchConditions = [];

    if (activeOnly) {
      matchConditions.push({ isActive: true });
    }

    if (category) {
      matchConditions.push({ category });
    }

    // 최소 유사도 점수 조건
    matchConditions.push({
      $expr: { $gte: [{ $meta: "vectorSearchScore" }, minScore] },
    });

    // 매치 조건 조합
    const matchStage =
      matchConditions.length > 1
        ? { $match: { $and: matchConditions } }
        : { $match: matchConditions[0] };

    // MongoDB Atlas Vector Search 파이프라인
    const pipeline = [
      {
        $vectorSearch: {
          queryVector: vectorQuery,
          path: "vector",
          numCandidates: numCandidates,
          limit: limit * 2, // 필터링 후 충분한 결과를 위해 2배로 요청
          index: "vector_index", // MongoDB Atlas에 생성한 벡터 인덱스 이름으로 변경 필요
        },
      },
      matchStage,
      {
        $project: projection,
      },
      {
        $limit: limit, // 최종 제한
      },
    ];

    // 벡터 검색 실행
    const result = await this.aggregate(pipeline);

    // 사용 시간 업데이트 (결과에 포함된 가이드만)
    if (result.length > 0) {
      const guideIds = result.map((guide) => guide._id);
      this.updateMany(
        { _id: { $in: guideIds } },
        { $set: { lastUsedAt: new Date() } }
      ).catch((err) =>
        console.warn("마지막 사용 시간 업데이트 실패:", err.message)
      );
    }

    return result;
  } catch (error) {
    console.error("Vector search error:", error);
    return [];
  }
};

/**
 * 텍스트로 벡터 검색을 수행합니다. (임베딩 생성 후 벡터 검색)
 * @function searchByText
 * @memberof Styleguide
 * @static
 * @param {string} text - 검색 텍스트
 * @param {number} limit - 최대 결과 수
 * @param {Object} options - 추가 옵션
 * @param {Function} embedFn - 임베딩 생성 함수
 * @returns {Promise<Array>} 검색 결과
 */
StyleguideSchema.statics.searchByText = async function (
  text,
  limit = 5,
  options = {},
  embedFn
) {
  try {
    if (!text || typeof text !== "string" || text.trim().length === 0) {
      throw new Error("검색 텍스트가 유효하지 않습니다.");
    }

    // 임베딩 생성 함수가 제공된 경우 사용
    if (typeof embedFn === "function") {
      const vector = await embedFn(text);
      return await this.vectorSearch(vector, limit, options);
    } else {
      throw new Error("임베딩 생성 함수가 제공되지 않았습니다.");
    }
  } catch (error) {
    console.error("Text search error:", error);
    return [];
  }
};

/**
 * 유사한 가이드 찾기 (로컬 연산)
 * @function findSimilar
 * @memberof Styleguide
 * @param {number} limit - 최대 결과 수
 * @returns {Promise<Array>} 유사한 가이드 목록
 */
StyleguideSchema.methods.findSimilar = async function (limit = 3) {
  if (!this.vector || this.vector.length === 0) {
    return [];
  }

  try {
    // 같은 카테고리에서 유사한 가이드 찾기
    const model = this.constructor;
    return await model.vectorSearch(this.vector, limit, {
      includeVector: false,
      category: this.category, // 같은 카테고리 내에서만 검색
    });
  } catch (error) {
    console.error("Find similar guide error:", error);
    return [];
  }
};

/**
 * 스타일 가이드 저장 전 처리
 */
StyleguideSchema.pre("save", function (next) {
  // 태그 정규화: 중복 제거, 공백 제거
  if (this.tags && Array.isArray(this.tags)) {
    this.tags = [
      ...new Set(this.tags.map((tag) => tag.trim()).filter(Boolean)),
    ];
  }

  next();
});

// 스타일 가이드 모델 생성 및 반환
module.exports =
  mongoose.models.Styleguide || mongoose.model("Styleguide", StyleguideSchema);
