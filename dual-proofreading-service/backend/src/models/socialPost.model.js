const mongoose = require("mongoose");

const socialPostSchema = new mongoose.Schema(
  {
    articleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Article",
      required: true,
    },
    platform: {
      type: String,
      enum: ["instagram", "facebook", "twitter", "thread", "linkedin"],
      required: true,
    },
    originalText: {
      type: String,
      required: true,
    },
    adaptedText: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["ready", "published", "failed"],
      default: "ready",
    },
    publishedAt: {
      type: Date,
    },
    platformPostId: {
      type: String,
    },
    platformData: {
      type: Object,
      default: {},
    },
    metadata: {
      type: Object,
      default: {},
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("SocialPost", socialPostSchema);
