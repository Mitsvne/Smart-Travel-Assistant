/**
 * 工具结果缓存模块
 *
 * 对 Agent 工具调用结果做 MD5 哈希 + TTL 缓存，避免重复请求外部 API。
 * - 天气：30min TTL（天气短期不变）
 * - POI / 酒店 / 知识库：24h TTL（静态数据）
 * - 机票 / 汇率：1h TTL
 * - 预算计算：永不过期（纯计算，同样输入→同样输出）
 *
 * 缓存 key = MD5(toolName + JSON.stringify(sortedParams))
 */

import crypto from 'crypto';

// ── TTL 配置（毫秒）──
const TTL_CONFIG = {
  get_weather: 30 * 60 * 1000,       // 30 分钟
  search_poi: 24 * 60 * 60 * 1000,   // 24 小时
  search_flights: 60 * 60 * 1000,    // 1 小时
  search_hotels: 24 * 60 * 60 * 1000,// 24 小时
  convert_currency: 60 * 60 * 1000,  // 1 小时
  calculate_budget: Infinity,        // 永不过期
  search_knowledge: 24 * 60 * 60 * 1000 // 24 小时
};

const DEFAULT_TTL = 5 * 60 * 1000; // 默认 5 分钟

/** @type {Map<string, {result: string, timestamp: number}>} */
const store = new Map();

const MAX_SIZE = 500; // 最多缓存 500 条

// ── 统计 ──
let hits = 0;
let misses = 0;

/**
 * 计算参数的 MD5 哈希作为缓存 key
 * 对 params 的 key 排序，保证 {a:1,b:2} 和 {b:2,a:1} 命中同一缓存
 */
function hashKey(toolName, params) {
  const sorted = params ? JSON.stringify(params, Object.keys(params || {}).sort()) : '{}';
  const raw = `${toolName}:${sorted}`;
  return crypto.createHash('md5').update(raw).digest('hex');
}

/**
 * 查询缓存
 * @returns {string|null} 缓存的结果字符串，null 表示未命中
 */
export function getCachedToolResult(toolName, params) {
  const key = hashKey(toolName, params);
  const entry = store.get(key);

  if (!entry) {
    misses++;
    return null;
  }

  const ttl = TTL_CONFIG[toolName] ?? DEFAULT_TTL;
  const expired = ttl !== Infinity && (Date.now() - entry.timestamp) > ttl;

  if (expired) {
    store.delete(key);
    misses++;
    return null;
  }

  hits++;
  return entry.result;
}

/**
 * 写入缓存
 */
export function setCachedToolResult(toolName, params, result) {
  const key = hashKey(toolName, params);
  store.set(key, {
    result: String(result),
    timestamp: Date.now()
  });

  // LRU 淘汰：超过上限时删除最老的条目
  if (store.size > MAX_SIZE) {
    let oldestKey = null;
    let oldestTime = Infinity;
    for (const [k, v] of store) {
      if (v.timestamp < oldestTime) {
        oldestTime = v.timestamp;
        oldestKey = k;
      }
    }
    if (oldestKey) store.delete(oldestKey);
  }
}

/**
 * 获取缓存统计
 */
export function getToolCacheStats() {
  return {
    size: store.size,
    maxSize: MAX_SIZE,
    hits,
    misses,
    total: hits + misses,
    hitRate: (hits + misses) > 0 ? Math.round((hits / (hits + misses)) * 100) : 0,
    entries: [...store.entries()].slice(0, 20).map(([k, v]) => ({
      key: k.slice(0, 16) + '...',
      age: Math.round((Date.now() - v.timestamp) / 1000) + 's',
      preview: String(v.result).slice(0, 80)
    }))
  };
}

/**
 * 清空缓存
 */
export function clearToolCache() {
  store.clear();
  hits = 0;
  misses = 0;
}

/**
 * 生成缓存 key 预览（用于调试/日志）
 */
export function previewKey(toolName, params) {
  return hashKey(toolName, params).slice(0, 8);
}
