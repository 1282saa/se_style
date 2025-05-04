/**
 * 사용자 선택 모델
 * @module models/userChoice
 */

const mongoose = require("mongoose");
const Schema = mongoose.Schema;

/**
 * 사용자 선호도 스키마
 */
const PreferencesSchema = new Schema(
  {
    preferredStyle: {
      type: String,
      enum: ["minimal", "enhanced", "neutral", "custom"],
      default: "neutral",
      description: "선호하는 교정 스타일",
    },
    formality: {
      type: String,
      enum: ["formal", "informal", "neutral"],
      default: "neutral",
      description: "선호하는 문체 격식",
    },
    conciseness: {
      type: String,
      enum: ["concise", "detailed", "neutral"],
      default: "neutral",
      description: "선호하는 문장 간결성",
    },
    customSettings: {
      type: Map,
      of: Schema.Types.Mixed,
      default: {},
      description: "기타 맞춤 설정",
    },
  },
  { _id: false }
);

/**
 * 사용자 선택 스키마
 * @typedef {Object} UserChoice
 * @property {ObjectId} articleId - 기사 ID
 * @property {number} selectedPromptType - 선택한 프롬프트 유형 (1: 최소한 교열, 2: 적극적 교열, 3: 맞춤형 교열)
 * @property {number} rating - 별점 평가 (1-5)
 * @property {string} comment - 사용자 코멘트
 * @property {Map} preferences - 사용자 선호도 정보
 * @property {boolean} hasFeedback - 피드백 제공 여부 (가상 필드)
 * @property {Date} createdAt - 생성일
 * @property {Date} updatedAt - 수정일
 */
const UserChoiceSchema = new Schema(
  {
    articleId: {
      type: Schema.Types.ObjectId,
      ref: "Article",
      required: true,
      index: true,
      description: "피드백을 제공한 기사 ID",
    },
    selectedPromptType: {
      type: Number,
      required: true,
      enum: [1, 2, 3], // 1: 최소한 교열, 2: 적극적 교열, 3: 맞춤형 교열
      index: true,
      description: "사용자가 선택한 교정 유형",
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      default: null,
      description: "사용자 별점 평가 (1-5)",
    },
    comment: {
      type: String,
      default: "",
      description: "사용자 피드백 코멘트",
      trim: true,
      maxlength: [1000, "코멘트는 1000자를 초과할 수 없습니다"],
    },
    preferences: {
      type: PreferencesSchema, // 스키마 사용
      default: () => ({}),
      description: "사용자 선호도 정보",
    },
    userId: {
      type: String,
      required: true,
      index: true,
      description: "피드백을 제공한 사용자 ID",
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
 * 피드백 여부 가상 필드
 */
UserChoiceSchema.virtual("hasFeedback").get(function () {
  return (
    this.rating !== null || (this.comment && this.comment.trim().length > 0)
  );
});

/**
 * 피드백 제공 시간 (생성 후 경과 시간) 가상 필드
 */
UserChoiceSchema.virtual("feedbackTime").get(function () {
  return this.updatedAt
    ? this.updatedAt.getTime() - this.createdAt.getTime()
    : 0;
});

/**
 * 선택한 교정 유형 이름 가상 필드
 */
UserChoiceSchema.virtual("selectedTypeName").get(function () {
  switch (this.selectedPromptType) {
    case 1:
      return "minimal";
    case 2:
      return "enhanced";
    case 3:
      return "custom";
    default:
      return "unknown";
  }
});

/**
 * 피드백 요약 제공
 * @function getFeedbackSummary
 * @memberof UserChoice
 * @returns {Object} 피드백 요약 정보
 */
UserChoiceSchema.methods.getFeedbackSummary = function () {
  const hasFeedback = this.hasFeedback;

  return {
    hasFeedback,
    rating: this.rating,
    hasComment: this.comment && this.comment.trim().length > 0,
    commentLength: this.comment ? this.comment.trim().length : 0,
    selectedType: this.selectedTypeName,
    userId: this.userId,
    createdAt: this.createdAt,
  };
};

/**
 * 상세 피드백 정보 제공
 * @function getDetailedFeedback
 * @memberof UserChoice
 * @returns {Object} 상세 피드백 정보
 */
UserChoiceSchema.methods.getDetailedFeedback = function () {
  return {
    id: this._id,
    articleId: this.articleId,
    selectedType: this.selectedTypeName,
    rating: this.rating,
    comment: this.comment,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    preferences: this.preferences
      ? {
          preferredStyle: this.preferences.preferredStyle,
          formality: this.preferences.formality,
          conciseness: this.preferences.conciseness,
          customSettings: this.preferences.customSettings
            ? Object.fromEntries(this.preferences.customSettings)
            : {},
        }
      : {},
    userId: this.userId,
  };
};

/**
 * 사용자 선호도 업데이트
 * @function updatePreferences
 * @memberof UserChoice
 * @param {Object} newPreferences - 새 선호도 설정
 * @returns {Promise<Object>} 업데이트된 선택 객체
 */
UserChoiceSchema.methods.updatePreferences = async function (newPreferences) {
  if (!newPreferences) return this;

  // 선호도 업데이트
  if (newPreferences.preferredStyle) {
    this.preferences.preferredStyle = newPreferences.preferredStyle;
  }

  if (newPreferences.formality) {
    this.preferences.formality = newPreferences.formality;
  }

  if (newPreferences.conciseness) {
    this.preferences.conciseness = newPreferences.conciseness;
  }

  // 커스텀 설정 업데이트
  if (
    newPreferences.customSettings &&
    typeof newPreferences.customSettings === "object"
  ) {
    const customSettings = this.preferences.customSettings || new Map();

    Object.entries(newPreferences.customSettings).forEach(([key, value]) => {
      customSettings.set(key, value);
    });

    this.preferences.customSettings = customSettings;
  }

  return await this.save();
};

// 관계 정의 (가상 필드)
UserChoiceSchema.virtual("article", {
  ref: "Article",
  localField: "articleId",
  foreignField: "_id",
  justOne: true,
});

UserChoiceSchema.virtual("selectedCorrection", {
  ref: "Correction",
  localField: "articleId",
  foreignField: "articleId",
  justOne: true,
  options: {
    match: function () {
      return { promptType: this.selectedPromptType };
    },
  },
});

// 인덱스 설정
UserChoiceSchema.index({ articleId: 1 }, { unique: true });
UserChoiceSchema.index({ selectedPromptType: 1 });
UserChoiceSchema.index({ rating: 1 });
UserChoiceSchema.index({ createdAt: -1 });
UserChoiceSchema.index({ userId: 1, createdAt: -1 });

/**
 * 피드백 저장 전 처리
 */
UserChoiceSchema.pre("save", function (next) {
  // 코멘트 정규화: 빈 문자열은 null로 처리
  if (this.comment && this.comment.trim().length === 0) {
    this.comment = "";
  }

  // 선호도 필드가 없으면 기본값 설정
  if (!this.preferences) {
    this.preferences = {};
  }

  next();
});

module.exports = mongoose.model("UserChoice", UserChoiceSchema);
