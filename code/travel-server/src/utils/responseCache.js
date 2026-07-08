/**
 * 普通模式响应缓存
 *
 * 对 /chat 端点（普通模式）的 LLM 回复做 MD5 哈希缓存。
 * 相同或高度相似的查询在 TTL 内直接返回缓存结果，跳过 LLM 调用。
 *
 * 缓存策略：
 *   - Key = MD5(归一化查询)
 *   - TTL = 30 分钟
 *   - 最多 200 条
 */

import crypto from 'crypto';

const TTL = 30 * 60 * 1000; // 30 分钟
const MAX_SIZE = 200;

/** @type {Map<string, {response: string, timestamp: number}>} */
const store = new Map();

let hits = 0;
let misses = 0;

/**
 * 归一化查询文本
 */
function normalize(text) {
  return text
    .toLowerCase()
    .replace(/[，。！？、；：""''（）\s]+/g, ' ')  // 中文标点 → 空格
    .replace(/[,.\!\?;:'"()\s]+/g, ' ')            // 英文标点 → 空格
    .replace(/\s+/g, ' ')                           // 合并空格
    .trim();
}

/**
 * 生成缓存 key
 */
function cacheKey(normalized) {
  return crypto.createHash('md5').update(normalized).digest('hex');
}

/**
 * 查询缓存
 * @returns {string|null} 缓存的完整回复文本，null 表示未命中
 */
export function getCachedResponse(message) {
  const normalized = normalize(message);
  if (normalized.length < 3) return null; // 太短不缓存

  const key = cacheKey(normalized);
  const entry = store.get(key);

  if (!entry) {
    misses++;
    return null;
  }

  if (Date.now() - entry.timestamp > TTL) {
    store.delete(key);
    misses++;
    return null;
  }

  hits++;
  return entry.response;
}

/**
 * 写入缓存
 */
export function setCachedResponse(message, response) {
  const normalized = normalize(message);
  if (normalized.length < 3) return;

  const key = cacheKey(normalized);
  store.set(key, {
    response: String(response),
    timestamp: Date.now()
  });

  // LRU 淘汰
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
 * 获取统计
 */
export function getResponseCacheStats() {
  return {
    size: store.size,
    maxSize: MAX_SIZE,
    hits,
    misses,
    total: hits + misses,
    hitRate: (hits + misses) > 0 ? Math.round((hits / (hits + misses)) * 100) : 0,
    ttlMinutes: TTL / 60000
  };
}

/**
 * 清空
 */
export function clearResponseCache() {
  store.clear();
  hits = 0;
  misses = 0;
}
