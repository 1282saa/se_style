// src/services/llm/anthropicService.js
//--------------------------------------------------
/* Claude 3 교열 + 임베딩 래퍼 (30 s 타임아웃·Redis TTL 캐시) */

const Anthropic = require("@anthropic-ai/sdk");
const { AppError } = require("../../utils/error");
const logger = require("../../utils/logger");
const config = require("../../config");
const cache = require("../../utils/cache");
const redis = require("../../utils/redisClient");
const { estimateTokens } = require("../../utils/tokens");

const MASK_PII = (s = "") =>
  s
    .replace(/[\d\w._%+-]+@[\d\w.-]+\.[A-Za-z]{2,}/g, "[email]")
    .replace(/\b01[0-9]-?\d{3,4}-?\d{4}\b/g, "[phone]");

class AnthropicService {
  constructor() {
    if (!config.ANTHROPIC_API_KEY)
      throw new Error("ANTHROPIC_API_KEY 누락—서비스 중단");

    this.client = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });
    this.model = config.CLAUDE_MODEL || "claude-3-opus-20240229";
    this.maxTokens = Number(config.ANTHROPIC_MAX_TOKENS) || 4000;
    this.embedModel = config.EMBEDDING_MODEL || "claude-3-sonnet-20240229";

    logger.info(`AnthropicService 초기화 (model=${this.model})`);
  }

  /* ---------- 1. 교열 ---------- */
  async proofread(
    { prompt, textToAnalyze },
    { cacheKey, model = this.model } = {}
  ) {
    logger.debug(`prompt(200↓): "${MASK_PII(prompt).slice(0, 200)}…"`);
    if (cacheKey) {
      const mHit = cache.get(cacheKey);
      if (mHit) return mHit;
      const rHit = await redis.get(cacheKey);
      if (rHit) return JSON.parse(rHit);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);

    let res;
    try {
      res = await this.client.messages.create({
        model,
        max_tokens: Math.min(this.maxTokens, 8000 - estimateTokens(prompt)),
        temperature: 0.3,
        system:
          "당신은 한국어 교정 전문가입니다. 텍스트의 맞춤법, 문법, 표현을 정확하게 교정하고 개선점을 제안합니다.",
        messages: [{ role: "user", content: prompt }],
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timer);
      throw new AppError("PROOFREAD_TIMEOUT", 502, err.message);
    }
    clearTimeout(timer);

    const result = this.#parse(res, textToAnalyze);

    if (cacheKey) {
      cache.set(cacheKey, result);
      redis.set(cacheKey, JSON.stringify(result), "EX", 3600);
    }
    logger.info(`proofread 완료 (tokens=${result.metadata.totalTokens})`);
    return result;
  }

  /* ---------- 2. 임베딩 ---------- */
  async createEmbedding(text) {
    const truncated = text.length > 8000 ? text.slice(0, 8000) : text;
    const { embedding } = await this.client.embeddings.create({
      model: this.embedModel,
      input: truncated,
    });
    return embedding;
  }

  /* ---------- private ---------- */
  #parse(r, origin) {
    const t = r.content?.[0]?.text || "";
    const m = {
      model: r.model,
      promptTokens: r.usage?.input_tokens ?? 0,
      completionTokens: r.usage?.output_tokens ?? 0,
      totalTokens: r.usage?.total_tokens ?? 0,
    };
    const j = t.match(/```json\s*([\s\S]*?)\s*```/) || t.match(/{[\s\S]*?}/);
    if (j) {
      try {
        const p = JSON.parse(j[1] || j[0]);
        return {
          correctedText: p.correctedText || p.corrected_text,
          corrections: p.corrections || p.changes || [],
          metadata: m,
        };
      } catch {
        /* fall-through */
      }
    }
    return { correctedText: t, corrections: [], metadata: m };
  }
}

module.exports = new AnthropicService();
