/**
 * 工具调用成功率追踪
 * 极小模块 — 只记录每个工具的调用次数和成功/失败次数
 */

/** @type {Map<string, {success: number, fail: number}>} */
const stats = new Map();

function ensure(toolName) {
  if (!stats.has(toolName)) {
    stats.set(toolName, { success: 0, fail: 0 });
  }
  return stats.get(toolName);
}

export function recordToolSuccess(toolName) {
  ensure(toolName).success++;
}

export function recordToolFailure(toolName) {
  ensure(toolName).fail++;
}

export function getToolSuccessStats() {
  const result = {};
  let totalSuccess = 0;
  let totalFail = 0;
  for (const [name, s] of stats) {
    result[name] = { ...s, rate: s.success + s.fail > 0 ? Math.round(s.success / (s.success + s.fail) * 100) : null };
    totalSuccess += s.success;
    totalFail += s.fail;
  }
  const total = totalSuccess + totalFail;
  result._overall = {
    success: totalSuccess,
    fail: totalFail,
    total,
    rate: total > 0 ? Math.round((totalSuccess / total) * 100) : null
  };
  return result;
}

export function clearToolStats() {
  stats.clear();
}
