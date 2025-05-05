/**
 * Redis 클라이언트 (ioredis)
 *  - .env의  REDIS_URL  사용. 없으면 메모리 폴백.
 */

const Redis = require("ioredis");
const logger = require("./logger");
const url = process.env.REDIS_URL || "";

let redis;
if (url) {
  redis = new Redis(url);
  redis.on("connect", () => logger.info("[Redis] connected"));
  redis.on("error", (e) => logger.error(`[Redis] ${e.message}`));
} else {
  // 폴백: 간단 in-mem Map, 프로덕션에선 반드시 Redis 사용
  logger.warn("[Redis] REDIS_URL 미설정 – 인메모리 캐시로 대체");
  redis = {
    store: new Map(),
    async get(k) {
      return this.store.get(k);
    },
    async set(k, v, mode, ttl) {
      this.store.set(k, v);
      if (mode === "EX") setTimeout(() => this.store.delete(k), ttl * 1000);
    },
  };
}

module.exports = redis;
