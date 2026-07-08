/**
 * 缓存效率 Benchmark — 测试双层缓存（工具缓存 + 响应缓存）
 *
 * 用法：
 *   cd code/travel-server
 *   node scripts/benchmark-cache.js
 *
 * 前提：服务已启动在 http://localhost:3000
 */

const BASE_URL = process.env.BENCHMARK_URL || 'http://localhost:3000';

// ── 测试用例 ──
const AGENT_QUERIES = [
  { label: '天气-北京', query: '北京明天天气怎么样？', tool: 'get_weather' },
  { label: '汇率-美元', query: '100美元等于多少人民币？', tool: 'convert_currency' },
  { label: 'POI-成都', query: '成都有哪些必去的景点？', tool: 'search_poi' },
];

const CHAT_QUERIES = [
  { label: '自我介绍', query: '你好，请介绍一下你自己' },
  { label: '旅行贴士', query: '去高原旅行需要注意什么？' },
];

const DELAY_BETWEEN = 3000;

// ─────────────────────────────────────────────
// 主流程
// ─────────────────────────────────────────────
async function main() {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║   双层缓存 Benchmark                    ║');
  console.log('╚══════════════════════════════════════════╝\n');

  // 清空所有缓存
  await fetch(`${BASE_URL}/api/travel/agent/tool-cache`, { method: 'DELETE' }).catch(() => {});
  await fetch(`${BASE_URL}/api/travel/cache-stats`, { method: 'DELETE' }).catch(() => {});
  console.log('已清空所有缓存\n');

  // ── 测试 1：工具缓存 ──
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔧 工具结果缓存 (toolCache)');
  console.log('   机制: MD5(toolName+params) → 结果, TTL 30min~24h');
  console.log('   命中: 从内存读取，~0ms');
  console.log('   未命中: 调用外部 API (天气/汇率/POI)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const toolResults = { cold: [], warm: [] };

  // 冷缓存：第一次调用
  console.log('--- 冷缓存 (首次调用) ---');
  for (const test of AGENT_QUERIES) {
    const r = await runAgentQuery(test);
    toolResults.cold.push(r);
    console.log(`  ${test.label}: TTFT=${r.ttftMs}ms 总=${r.totalMs}ms 工具=${r.toolCallCount}个`);
    await sleep(DELAY_BETWEEN);
  }

  // 热缓存：第二次调用（工具结果已在缓存中）
  console.log('\n--- 热缓存 (二次调用，工具结果应命中) ---');
  for (const test of AGENT_QUERIES) {
    const r = await runAgentQuery(test);
    toolResults.warm.push(r);
    const cold = toolResults.cold.find(c => c.label === test.label);
    const improvement = cold ? Math.round((1 - r.totalMs / cold.totalMs) * 100) : null;
    console.log(`  ${test.label}: TTFT=${r.ttftMs}ms 总=${r.totalMs}ms ${improvement !== null ? `提升 ${improvement}%` : ''}`);
    await sleep(DELAY_BETWEEN);
  }

  // ── 测试 2：响应缓存 ──
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('💬 响应缓存 (responseCache)');
  console.log('   机制: MD5(归一化query) → LLM回复, TTL 30min');
  console.log('   命中: 直接返回缓存文本，跳过 LLM 调用');
  console.log('   未命中: 正常调用 LLM 流式生成');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const chatResults = { cold: [], warm: [] };

  console.log('--- 冷缓存 (首次调用) ---');
  for (const test of CHAT_QUERIES) {
    const r = await runChatQuery(test);
    chatResults.cold.push(r);
    console.log(`  ${test.label}: TTFT=${r.ttftMs}ms 总=${r.totalMs}ms`);
    await sleep(DELAY_BETWEEN);
  }

  console.log('\n--- 热缓存 (二次调用，响应应命中) ---');
  for (const test of CHAT_QUERIES) {
    const r = await runChatQuery(test);
    chatResults.warm.push(r);
    const cold = chatResults.cold.find(c => c.label === test.label);
    const improvement = cold ? Math.round((1 - r.totalMs / cold.totalMs) * 100) : null;
    console.log(`  ${test.label}: TTFT=${r.ttftMs}ms 总=${r.totalMs}ms ${improvement !== null ? `提升 ${improvement}%` : ''}`);
    await sleep(DELAY_BETWEEN);
  }

  // ── 获取服务端缓存统计 ──
  let toolStats = null;
  try {
    const res = await fetch(`${BASE_URL}/api/travel/agent/tool-cache-stats`);
    toolStats = (await res.json()).data;
  } catch {}

  // ── 报告 ──
  printReport(toolResults, chatResults, toolStats);
}

// ─────────────────────────────────────────────
// 测试函数
// ─────────────────────────────────────────────
function runAgentQuery(test) {
  return new Promise((resolve, reject) => {
    const startTime = performance.now();
    let firstChunkTime = null;
    let chunkCount = 0;
    let toolCallCount = 0;

    const controller = new AbortController();
    setTimeout(() => { controller.abort(); reject(new Error('timeout')); }, 60000);

    fetch(`${BASE_URL}/api/travel/agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: test.query,
        history: [],
        threadId: `cache_bench_${test.label}_${Date.now()}`
      }),
      signal: controller.signal
    }).then(async (response) => {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split('\n')) {
          if (line.startsWith('data: ')) {
            try {
              const d = JSON.parse(line.substring(6));
              if ((d.type === 'agent/chunk') && !firstChunkTime) {
                firstChunkTime = performance.now();
              }
              if (d.type === 'agent/chunk') chunkCount++;
              if (d.type === 'agent/tool_call') toolCallCount++;
            } catch {}
          }
        }
      }
      resolve({
        label: test.label,
        ttftMs: firstChunkTime ? Math.round(firstChunkTime - startTime) : null,
        totalMs: Math.round(performance.now() - startTime),
        chunkCount,
        toolCallCount
      });
    }).catch(reject);
  });
}

function runChatQuery(test) {
  return new Promise((resolve, reject) => {
    const startTime = performance.now();
    let firstChunkTime = null;
    let chunkCount = 0;

    const controller = new AbortController();
    setTimeout(() => { controller.abort(); reject(new Error('timeout')); }, 60000);

    fetch(`${BASE_URL}/api/travel/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: test.query, history: [] }),
      signal: controller.signal
    }).then(async (response) => {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split('\n')) {
          if (line.startsWith('data: ')) {
            try {
              const d = JSON.parse(line.substring(6));
              if (d.type === 'chunk' && !firstChunkTime) {
                firstChunkTime = performance.now();
              }
              if (d.type === 'chunk') chunkCount++;
            } catch {}
          }
        }
      }
      resolve({
        label: test.label,
        ttftMs: firstChunkTime ? Math.round(firstChunkTime - startTime) : null,
        totalMs: Math.round(performance.now() - startTime),
        chunkCount
      });
    }).catch(reject);
  });
}

// ─────────────────────────────────────────────
// 报告
// ─────────────────────────────────────────────
function printReport(toolResults, chatResults, toolStats) {
  console.log('\n\n');
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║           📊 缓存效率测试报告                        ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  // 工具缓存
  console.log('┌─ 🔧 工具结果缓存 ───────────────────────────────────┐');
  console.log('│ 用例          │ 冷缓存总耗时 │ 热缓存总耗时 │ 提升    │');
  console.log('│───────────────┼──────────────┼──────────────┼─────────│');
  for (let i = 0; i < toolResults.cold.length; i++) {
    const cold = toolResults.cold[i];
    const warm = toolResults.warm[i];
    const imp = warm ? Math.round((1 - warm.totalMs / cold.totalMs) * 100) : null;
    console.log(`│ ${cold.label.padEnd(13)} │ ${String(cold.totalMs+'ms').padStart(8)}     │ ${String(warm.totalMs+'ms').padStart(8)}     │ ${imp !== null ? String(imp+'%').padStart(5) : 'N/A'}   │`);
  }
  console.log('└──────────────────────────────────────────────────────┘');

  // 响应缓存
  console.log('\n┌─ 💬 响应缓存 ───────────────────────────────────────┐');
  console.log('│ 用例          │ 冷缓存总耗时 │ 热缓存总耗时 │ 提升    │');
  console.log('│───────────────┼──────────────┼──────────────┼─────────│');
  for (let i = 0; i < chatResults.cold.length; i++) {
    const cold = chatResults.cold[i];
    const warm = chatResults.warm[i];
    const imp = warm ? Math.round((1 - warm.totalMs / cold.totalMs) * 100) : null;
    console.log(`│ ${cold.label.padEnd(13)} │ ${String(cold.totalMs+'ms').padStart(8)}     │ ${String(warm.totalMs+'ms').padStart(8)}     │ ${imp !== null ? String(imp+'%').padStart(5) : 'N/A'}   │`);
  }
  console.log('└──────────────────────────────────────────────────────┘');

  // 服务端统计
  if (toolStats) {
    console.log(`\n📊 服务端工具缓存统计:`);
    console.log(`   条目数: ${toolStats.size} | 命中: ${toolStats.hits} | 未命中: ${toolStats.misses} | 命中率: ${toolStats.hitRate}%`);
  }

  // ── JSON ──
  console.log('\n--- JSON ---');
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    toolCache: {
      cold: toolResults.cold,
      warm: toolResults.warm,
      serverStats: toolStats
    },
    responseCache: {
      cold: chatResults.cold,
      warm: chatResults.warm
    }
  }, null, 2));

  console.log('\n✅ 完成');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

main().catch(console.error);
