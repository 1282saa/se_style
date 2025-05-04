/**
 * 교정 작업 모델
 * @module models/proofreading
 */

const mongoose = require("mongoose");
const Schema = mongoose.Schema;

/**
 * 교정 통계 스키마
 */
const ProofreadingStatsSchema = new Schema(
  {
    processingTime: {
      type: Number,
      description: "처리 시간 (밀리초)",
      min: 0,
    },
    correctionCount: {
      type: Number,
      description: "생성된 교정 수",
      min: 0,
      default: 0,
    },
    tokenCount: {
      type: Number,
      description: "사용된 총 토큰 수",
      min: 0,
      default: 0,
    },
    changeCount: {
      type: Number,
      description: "변경 사항 수",
      min: 0,
      default: 0,
    },
  },
  { _id: false }
);

/**
 * 교정 작업 스키마
 * @typedef {Object} Proofreading
 * @property {ObjectId} articleId - 기사 ID
 * @property {string} userId - 사용자 ID
 * @property {string} status - 상태 (pending, processing, completed, failed)
 * @property {Array<ObjectId>} corrections - 교정 결과 ID 목록
 * @property {Array<ObjectId>} styleGuides - 적용된 스타일 가이드 ID 목록
 * @property {Object} stats - 통계 정보
 * @property {Object} metadata - 메타데이터
 * @property {Date} startedAt - 시작 시간
 * @property {Date} completedAt - 완료 시간
 * @property {Date} createdAt - 생성일
 * @property {Date} updatedAt - 수정일
 */
const ProofreadingSchema = new Schema(
  {
    articleId: {
      type: Schema.Types.ObjectId,
      ref: "Article",
      required: true,
      index: true,
      description: "교정 대상 기사 ID",
    },
    userId: {
      type: String,
      required: true,
      index: true,
      description: "교정 요청자 ID",
    },
    status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
      index: true,
      description: "교정 작업 상태",
    },
    corrections: [
      {
        type: Schema.Types.ObjectId,
        ref: "Correction",
        description: "생성된 교정 결과 ID 목록",
      },
    ],
    styleGuides: [
      {
        type: Schema.Types.ObjectId,
        ref: "Styleguide",
        description: "적용된 스타일 가이드 ID 목록",
      },
    ],
    stats: {
      type: ProofreadingStatsSchema,
      default: () => ({}),
      description: "교정 통계 정보",
    },
    metadata: {
      type: Map,
      of: Schema.Types.Mixed,
      default: {},
      description: "추가 메타데이터",
    },
    startedAt: {
      type: Date,
      description: "교정 시작 시간",
    },
    completedAt: {
      type: Date,
      description: "교정 완료 시간",
    },
    error: {
      type: String,
      description: "오류 발생 시 오류 메시지",
    },
    retryCount: {
      type: Number,
      default: 0,
      description: "재시도 횟수",
    },
    priority: {
      type: Number,
      default: 0,
      description: "작업 우선순위 (높을수록 우선 처리)",
      index: true,
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
 * 교정 시간 계산 (밀리초)
 * @function calculateDuration
 * @memberof Proofreading
 * @returns {number} 교정 소요 시간 (밀리초)
 */
ProofreadingSchema.methods.calculateDuration = function () {
  if (!this.startedAt) return 0;

  const endTime = this.completedAt || new Date();
  return endTime.getTime() - this.startedAt.getTime();
};

/**
 * 교정 작업 시작 표시
 * @function markAsStarted
 * @memberof Proofreading
 * @returns {Promise<Object>} 업데이트된 교정 작업
 */
ProofreadingSchema.methods.markAsStarted = async function () {
  this.status = "processing";
  this.startedAt = new Date();
  return await this.save();
};

/**
 * 교정 작업 완료 표시
 * @function markAsCompleted
 * @memberof Proofreading
 * @param {Array<ObjectId>} correctionIds - 생성된 교정 결과 ID 목록
 * @param {Object} stats - 통계 정보
 * @returns {Promise<Object>} 업데이트된 교정 작업
 */
ProofreadingSchema.methods.markAsCompleted = async function (
  correctionIds,
  stats = {}
) {
  this.status = "completed";
  this.completedAt = new Date();
  this.corrections = correctionIds || this.corrections;

  // 통계 정보 업데이트
  const processingTime = this.calculateDuration();
  this.stats = {
    processingTime,
    correctionCount: correctionIds ? correctionIds.length : 0,
    tokenCount: stats.tokenCount || 0,
    changeCount: stats.changeCount || 0,
    ...stats,
  };

  return await this.save();
};

/**
 * 교정 작업 실패 표시
 * @function markAsFailed
 * @memberof Proofreading
 * @param {string} errorMessage - 오류 메시지
 * @param {boolean} retry - 재시도 여부
 * @returns {Promise<Object>} 업데이트된 교정 작업
 */
ProofreadingSchema.methods.markAsFailed = async function (
  errorMessage,
  retry = false
) {
  if (retry) {
    this.retryCount += 1;
    this.error = `재시도(${this.retryCount}): ${errorMessage}`;
    if (this.retryCount <= 3) {
      // 최대 3회까지만 재시도
      this.status = "pending"; // 재시도를 위해 상태 초기화
      return await this.save();
    }
  }

  this.status = "failed";
  this.completedAt = new Date();
  this.error = errorMessage;

  // 통계 정보 업데이트
  this.stats = {
    processingTime: this.calculateDuration(),
    correctionCount: 0,
    tokenCount: 0,
    changeCount: 0,
  };

  return await this.save();
};

/**
 * 작업 상태 요약 제공
 * @function getStatusSummary
 * @memberof Proofreading
 * @returns {Object} 작업 상태 요약 정보
 */
ProofreadingSchema.methods.getStatusSummary = function () {
  return {
    id: this._id,
    articleId: this.articleId,
    status: this.status,
    startedAt: this.startedAt,
    completedAt: this.completedAt,
    processingTime: this.calculateDuration(),
    correctionCount: this.corrections ? this.corrections.length : 0,
    hasError: !!this.error,
    retryCount: this.retryCount,
  };
};

/**
 * 진행 상태 가상 필드 (0~100%)
 */
ProofreadingSchema.virtual("progress").get(function () {
  switch (this.status) {
    case "pending":
      return 0;
    case "processing":
      return 50;
    case "completed":
      return 100;
    case "failed":
      return this.retryCount > 0 ? 25 : 0;
    default:
      return 0;
  }
});

// 관계 정의 (가상 필드)
ProofreadingSchema.virtual("article", {
  ref: "Article",
  localField: "articleId",
  foreignField: "_id",
  justOne: true,
});

// 인덱스 설정
ProofreadingSchema.index({ userId: 1, createdAt: -1 });
ProofreadingSchema.index({ status: 1, createdAt: -1 });
ProofreadingSchema.index({ articleId: 1 }, { unique: true });
ProofreadingSchema.index({ priority: -1, createdAt: 1 }); // 우선순위 및 생성 시간 기준 정렬 인덱스

module.exports = mongoose.model("Proofreading", ProofreadingSchema);
