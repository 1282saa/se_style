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
    tags: [{ type: String }],
    examples: [ExampleSchema],
    embedding: { type: [Number], index: true },
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
StyleguideSchema.index({ embedding: 1 });

/**
 * 검색 스코어 가상 속성
 */
StyleguideSchema.virtual("score").get(function () {
  return this._score;
});

StyleguideSchema.set("toJSON", {
  virtuals: true,
  transform: function (doc, ret) {
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
