const Joi = require("joi");

/**
 * 교정 요청 검증 스키마
 */
const proofreadSchema = Joi.object({
  text: Joi.string().required().max(10000).messages({
    "string.empty": "교정할 텍스트가 제공되지 않았습니다",
    "string.max": "텍스트 길이가 너무 깁니다. 10,000자 이하로 입력해주세요",
    "any.required": "교정할 텍스트가 필요합니다",
  }),
  userId: Joi.string().allow("").default("anonymous"),
  metadata: Joi.object().default({}),
});

/**
 * 사용자 선택 검증 스키마
 */
const choiceSchema = Joi.object({
  articleId: Joi.string().required().messages({
    "string.empty": "기사 ID가 제공되지 않았습니다",
    "any.required": "기사 ID가 필요합니다",
  }),
  correctionId: Joi.string().required().messages({
    "string.empty": "교정 결과 ID가 제공되지 않았습니다",
    "any.required": "교정 결과 ID가 필요합니다",
  }),
  rating: Joi.number().min(1).max(5).default(null),
  comment: Joi.string().allow("").default(""),
});

/**
 * 맞춤형 교정 요청 검증 스키마
 */
const customProofreadSchema = Joi.object({
  articleId: Joi.string().required().messages({
    "string.empty": "기사 ID가 제공되지 않았습니다",
    "any.required": "기사 ID가 필요합니다",
  }),
  userId: Joi.string().allow("").default("anonymous"),
  preferences: Joi.object({
    preferredStyle: Joi.string()
      .valid("minimal", "enhanced", "neutral", "custom")
      .default("neutral"),
    formality: Joi.string()
      .valid("formal", "informal", "neutral")
      .default("neutral"),
    conciseness: Joi.string()
      .valid("concise", "detailed", "neutral")
      .default("neutral"),
    focusAreas: Joi.array().items(Joi.string()).default([]),
  }).default({}),
});

module.exports = {
  proofreadSchema,
  choiceSchema,
  customProofreadSchema,
};
