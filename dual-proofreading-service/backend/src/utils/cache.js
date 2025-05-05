/**
 * 간단 LRU 인-메모리 캐시
 *  - production에선 Redis를 병행 사용
 */
const LRU = require("lru-cache");

const cache = new LRU({
  max: 500, // 항목 수
  ttl: 1000 * 60, // 1 분 기본 TTL
});

module.exports = cache;
