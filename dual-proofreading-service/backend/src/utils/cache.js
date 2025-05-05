/**
 * 간단한 메모리 캐시 구현
 * 실제 프로덕션 환경에서는 Redis 등 외부 캐시 시스템으로 교체 권장
 */

// 캐시 저장소
const cacheStore = new Map();

// 만료 시간 저장소
const expiryStore = new Map();

/**
 * 캐시에 값을 저장합니다.
 * @param {string} key - 캐시 키
 * @param {any} value - 저장할 값
 * @param {number} ttl - 만료 시간(초)
 */
function set(key, value, ttl = 3600) {
  if (!key) return;

  // 이전 타이머가 있으면 제거
  if (expiryStore.has(key)) {
    clearTimeout(expiryStore.get(key));
    expiryStore.delete(key);
  }

  // 값 저장
  cacheStore.set(key, value);

  // 만료 타이머 설정
  if (ttl > 0) {
    const timer = setTimeout(() => {
      cacheStore.delete(key);
      expiryStore.delete(key);
    }, ttl * 1000);

    expiryStore.set(key, timer);
  }
}

/**
 * 캐시에서 값을 조회합니다.
 * @param {string} key - 캐시 키
 * @returns {any} - 저장된 값 또는 undefined
 */
function get(key) {
  return cacheStore.get(key);
}

/**
 * 캐시에서 값을 삭제합니다.
 * @param {string} key - 캐시 키
 */
function del(key) {
  if (expiryStore.has(key)) {
    clearTimeout(expiryStore.get(key));
    expiryStore.delete(key);
  }

  cacheStore.delete(key);
}

/**
 * 특정 패턴에 해당하는 모든 캐시를 삭제합니다.
 * @param {string} pattern - 캐시 키 패턴
 */
function delByPattern(pattern) {
  const regex = new RegExp(pattern);

  for (const key of cacheStore.keys()) {
    if (regex.test(key)) {
      del(key);
    }
  }
}

/**
 * 모든 캐시를 비웁니다.
 */
function flush() {
  // 모든 타이머 제거
  for (const timer of expiryStore.values()) {
    clearTimeout(timer);
  }

  // 저장소 초기화
  cacheStore.clear();
  expiryStore.clear();
}

/**
 * 캐시 통계를 반환합니다.
 * @returns {Object} - 캐시 통계
 */
function stats() {
  return {
    size: cacheStore.size,
    keys: Array.from(cacheStore.keys()),
  };
}

module.exports = {
  set,
  get,
  del,
  delByPattern,
  flush,
  stats,
};
