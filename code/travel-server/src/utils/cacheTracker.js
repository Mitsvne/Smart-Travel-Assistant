/**
 * 缓存命中率追踪器
 *
 * 追踪各缓存点的命中/未命中次数和耗时，用于计算缓存效率提升。
 * 内存存储，服务重启后清空。
 */

const MAX_EVENTS = 1000;

/** @type {Array<{cache: string, hit: boolean, durationMs: number, key: string, timestamp: number}>} */
const events = [];

/**
 * 记录一次缓存访问
 * @param {string} cacheName - 缓存名称 (trip_history | currency_rates)
 * @param {boolean} hit - 是否命中
 * @param {number} durationMs - 本次查询耗时（毫秒）
 * @param {string} key - 缓存 key（截断存储）
 */
export function recordCacheAccess(cacheName, hit, durationMs, key = '') {
  events.unshift({
    cache: cacheName,
    hit,
    durationMs: Math.round(durationMs),
    key: String(key).slice(0, 80),
    timestamp: Date.now()
  });
  if (events.length > MAX_EVENTS) {
    events.pop();
  }
}

/**
 * 获取某个缓存点的统计数据
 */
export function getCacheStats(cacheName) {
  const filtered = cacheName
    ? events.filter(e => e.cache === cacheName)
    : events;

  if (filtered.length === 0) return null;

  const hits = filtered.filter(e => e.hit);
  const misses = filtered.filter(e => !e.hit);
  const hitCount = hits.length;
  const missCount = misses.length;
  const total = hitCount + missCount;

  const calc = (arr) => {
    if (arr.length === 0) return null;
    const vals = arr.map(e => e.durationMs).sort((a, b) => a - b);
    return {
      min: vals[0],
      p50: vals[Math.floor(vals.length * 0.5)],
      p90: vals[Math.floor(vals.length * 0.9)],
      avg: Math.round(vals.reduce((s, v) => s + v, 0) / vals.length),
      max: vals[vals.length - 1]
    };
  };

  // 计算命中时的加速比（相对于未命中平均耗时）
  const avgMissMs = misses.length > 0
    ? Math.round(misses.reduce((s, e) => s + e.durationMs, 0) / misses.length)
    : null;
  const avgHitMs = hits.length > 0
    ? Math.round(hits.reduce((s, e) => s + e.durationMs, 0) / hits.length)
    : null;

  const speedup = (avgMissMs && avgHitMs && avgMissMs > 0)
    ? Math.round((avgMissMs / avgHitMs) * 10) / 10
    : null;

  const improvementPercent = (avgMissMs && avgHitMs && avgMissMs > 0)
    ? Math.round((1 - avgHitMs / avgMissMs) * 100)
    : null;

  return {
    cache: cacheName || 'all',
    total,
    hits: hitCount,
    misses: missCount,
    hitRate: total > 0 ? Math.round((hitCount / total) * 100) : 0,
    hitDurationMs: calc(hits),
    missDurationMs: calc(misses),
    avgHitMs,
    avgMissMs,
    speedup,                    // 缓存命中比未命中快多少倍
    improvementPercent,         // 响应效率提升百分比
    recentEvents: filtered.slice(0, 10).map(e => ({
      hit: e.hit,
      durationMs: e.durationMs,
      key: e.key,
      timestamp: new Date(e.timestamp).toISOString()
    }))
  };
}

/**
 * 获取全部缓存点的汇总统计
 */
export function getAllCacheStats() {
  const cacheNames = [...new Set(events.map(e => e.cache))];
  const result = {};
  for (const name of cacheNames) {
    result[name] = getCacheStats(name);
  }
  result.overall = getCacheStats(null);
  return result;
}

/**
 * 清空记录
 */
export function clearCacheEvents() {
  events.length = 0;
}
