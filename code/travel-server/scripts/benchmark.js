/**
 * 延迟 Benchmark 脚本 — 同时测试普通模式 & Agent 模式
 *
 * 用法：
 *   cd code/travel-server
 *   node scripts/benchmark.js              # 测两种模式
 *   node scripts/benchmark.js --agent      # 仅 Agent 模式
 *   node scripts/benchmark.js --normal     # 仅普通模式
 *
 * 前提：服务已启动在 http://localhost:3000
 */

// ── 共用测试用例（两种模式都用同样的 query 保证公平对比）──
const TEST_QUERIES = [
  { label: '自我介绍', query: '你好，请介绍一下你自己' },
  { label: '能力边界', query: '你能帮我做什么？' },
  { label: '知识-景点', query: '北京故宫有什么值得看的地方？' },
  { label: '旅行贴士', query: '去高原旅行需要注意什么？' },
  { label: '天气-北京', query: '北京明天的天气怎么样？' },
  { label: 'POI-成都', query: '成都有哪些必去的景点？' },
  { label: '行程-简单', query: '帮我规划一个杭州2日游，预算2000元' },
  { label: '行程-完整', query: '我想去西安玩3天，预算3000元，帮我规划行程包括住宿和天气' },
];

// ── 配置 ──
const BASE_URL = process.env.BENCHMARK_URL || 'http://localhost:3000';
const DELAY_BETWEEN = 2000;

const MODES = {
  normal: {
    name: '普通模式',
    url: `${BASE_URL}/api/travel/chat`,
    body: (q) => ({ message: q, history: [] }),
    // 普通模式的 SSE: chunk 事件类型是 'chunk'（不是 agent/chunk）
    chunkType: 'chunk',
    hasToolCalls: false
  },
  agent: {
    name: 'Agent 模式',
    url: `${BASE_URL}/api/travel/agent`,
    body: (q) => ({
      message: q,
      history: [],
      threadId: `bench_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    }),
    chunkType: 'agent/chunk',
    hasToolCalls: true
  }
};

// ── 解析命令行参数 ──
const args = process.argv.slice(2);
const runNormal = args.includes('--normal') || (!args.includes('--agent'));
const runAgent = args.includes('--agent') || (!args.includes('--normal'));

// ─────────────────────────────────────────────
// 主流程
// ─────────────────────────────────────────────
async function main() {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║   延迟 Benchmark — 双模式对比           ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log(`\n目标服务: ${BASE_URL}`);
  console.log(`测试用例: ${TEST_QUERIES.length} 条`);
  console.log(`请求间隔: ${DELAY_BETWEEN}ms\n`);

  const allResults = {};

  // ── 普通模式 ──
  if (runNormal) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔵 普通模式 (单次流式 LLM 调用)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    allResults.normal = await runMode(MODES.normal);
  }

  // ── Agent 模式 ──
  if (runAgent) {
    // 清空 Agent 延迟记录，避免之前的请求污染统计
    try {
      await fetch(`${BASE_URL}/api/travel/agent/latency-records`, { method: 'DELETE' });
    } catch {}
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🟠 Agent 模式 (LangGraph ReAct)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    allResults.agent = await runMode(MODES.agent);
  }

  // ── 输出对比报告 ──
  printComparisonReport(allResults);
}

// ─────────────────────────────────────────────
// 运行某个模式的所有测试
// ─────────────────────────────────────────────
async function runMode(mode) {
  const results = [];

  for (let i = 0; i < TEST_QUERIES.length; i++) {
    const test = TEST_QUERIES[i];
    console.log(`  [${i + 1}/${TEST_QUERIES.length}] ${test.label}: "${test.query.slice(0, 45)}..."`);

    try {
      const result = await runSingleTest(mode, test);
      results.push(result);
      const tools = mode.hasToolCalls ? ` | 工具:${result.toolCallCount}个` : '';
      console.log(`    ✅ TTFT: ${result.ttftMs}ms | 总: ${result.totalMs}ms | chunks: ${result.chunkCount}${tools}`);
    } catch (err) {
      console.log(`    ❌ 失败: ${err.message}`);
      results.push({ label: test.label, query: test.query, error: err.message });
    }

    if (i < TEST_QUERIES.length - 1) {
      await sleep(DELAY_BETWEEN);
    }
  }

  return results;
}

// ─────────────────────────────────────────────
// 单次测试
// ─────────────────────────────────────────────
function runSingleTest(mode, test) {
  return new Promise((resolve, reject) => {
    const startTime = performance.now();
    let firstChunkTime = null;
    let chunkCount = 0;
    let toolCallCount = 0;
    let fullResponse = '';
    const events = [];

    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
      reject(new Error('请求超时 (60s)'));
    }, 60000);

    fetch(mode.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mode.body(test.query)),
      signal: controller.signal
    })
      .then(async (response) => {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n').filter(line => line.trim());

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.substring(6));
                events.push(data.type);

                // 首 token（兼容两种 chunk 类型）
                const isChunk = data.type === 'chunk' || data.type === 'agent/chunk';
                if (!firstChunkTime && isChunk) {
                  firstChunkTime = performance.now();
                }
                if (isChunk) {
                  chunkCount++;
                  fullResponse += data.content || '';
                }
                if (data.type === 'agent/tool_call') {
                  toolCallCount++;
                }
              } catch { /* skip */ }
            }
          }
        }

        clearTimeout(timeout);
        const endTime = performance.now();

        resolve({
          label: test.label,
          query: test.query,
          ttftMs: firstChunkTime ? Math.round(firstChunkTime - startTime) : null,
          totalMs: Math.round(endTime - startTime),
          chunkCount,
          toolCallCount,
          eventCount: events.length,
          responsePreview: fullResponse.slice(0, 100)
        });
      })
      .catch((err) => {
        clearTimeout(timeout);
        reject(err);
      });
  });
}

// ─────────────────────────────────────────────
// 对比报告
// ─────────────────────────────────────────────
function printComparisonReport(allResults) {
  console.log('\n\n');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║              📊 双模式延迟对比报告                      ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  const modes = Object.entries(allResults);

  // ── TTFT 对比 ──
  console.log('┌──────────────────────┬──────────┬──────────┬──────────┐');
  console.log('│ TTFT (首字延迟)      │    P50   │    P90   │    avg   │');
  console.log('├──────────────────────┼──────────┼──────────┼──────────┤');
  for (const [key, results] of modes) {
    const name = key === 'normal' ? '🔵 普通模式' : '🟠 Agent 模式';
    const valid = results.filter(r => !r.error && r.ttftMs);
    if (valid.length === 0) continue;
    const ttfts = valid.map(r => r.ttftMs);
    console.log(`│ ${name.padEnd(20)} │ ${String(p(ttfts, 0.5)).padStart(5)}ms │ ${String(p(ttfts, 0.9)).padStart(5)}ms │ ${String(avg(ttfts)).padStart(5)}ms │`);
  }
  console.log('└──────────────────────┴──────────┴──────────┴──────────┘');

  // ── 总耗时对比 ──
  console.log('\n┌──────────────────────┬──────────┬──────────┬──────────┐');
  console.log('│ 总耗时               │    P50   │    P90   │    avg   │');
  console.log('├──────────────────────┼──────────┼──────────┼──────────┤');
  for (const [key, results] of modes) {
    const name = key === 'normal' ? '🔵 普通模式' : '🟠 Agent 模式';
    const valid = results.filter(r => !r.error);
    if (valid.length === 0) continue;
    const totals = valid.map(r => r.totalMs);
    console.log(`│ ${name.padEnd(20)} │ ${String(p(totals, 0.5)).padStart(5)}ms │ ${String(p(totals, 0.9)).padStart(5)}ms │ ${String(avg(totals)).padStart(5)}ms │`);
  }
  console.log('└──────────────────────┴──────────┴──────────┴──────────┘');

  // ── 逐条对比 ──
  console.log('\n┌────────────────────┬────────────┬────────────┬────────────┬────────────┐');
  console.log('│ 用例               │ 普通 TTFT  │ Agent TTFT │ 普通 总耗时│ Agent 总耗时│');
  console.log('├────────────────────┼────────────┼────────────┼────────────┼────────────┤');

  for (const test of TEST_QUERIES) {
    const nResult = allResults.normal?.find(r => r.label === test.label);
    const aResult = allResults.agent?.find(r => r.label === test.label);

    const label = test.label.padEnd(18).slice(0, 18);
    const nTtft = nResult && !nResult.error ? `${nResult.ttftMs}ms`.padStart(8) : '   错误'.padStart(8);
    const aTtft = aResult && !aResult.error ? `${aResult.ttftMs}ms`.padStart(8) : '   错误'.padStart(8);
    const nTotal = nResult && !nResult.error ? `${nResult.totalMs}ms`.padStart(8) : '   错误'.padStart(8);
    const aTotal = aResult && !aResult.error ? `${aResult.totalMs}ms`.padStart(8) : '   错误'.padStart(8);

    console.log(`│ ${label} │ ${nTtft}  │ ${aTtft}  │ ${nTotal}  │ ${aTotal}  │`);
  }
  console.log('└────────────────────┴────────────┴────────────┴────────────┴────────────┘');

  // ── 失败 ──
  for (const [key, results] of modes) {
    const errors = results.filter(r => r.error);
    if (errors.length > 0) {
      console.log(`\n❌ ${key === 'normal' ? '普通模式' : 'Agent 模式'} 失败: ${errors.length} 条`);
      for (const e of errors) {
        console.log(`   - ${e.label}: ${e.error}`);
      }
    }
  }

  console.log('\n✅ Benchmark 完成\n');

  // ── JSON 输出 ──
  console.log('--- JSON ---');
  const jsonOutput = { timestamp: new Date().toISOString() };
  for (const [key, results] of modes) {
    const valid = results.filter(r => !r.error);
    jsonOutput[key] = {
      mode: key === 'normal' ? '普通模式' : 'Agent 模式',
      totalTests: results.length,
      successCount: valid.length,
      errorCount: results.length - valid.length,
      ttftMs: statsObj(valid.map(r => r.ttftMs).filter(Boolean)),
      totalMs: statsObj(valid.map(r => r.totalMs)),
      details: valid.map(r => ({
        label: r.label,
        query: r.query.slice(0, 80),
        ttftMs: r.ttftMs,
        totalMs: r.totalMs,
        toolCallCount: r.toolCallCount,
        chunkCount: r.chunkCount
      }))
    };
  }
  console.log(JSON.stringify(jsonOutput, null, 2));
}

// ── 工具函数 ──
function p(arr, percentile) {
  if (arr.length === 0) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length * percentile)];
}

function avg(arr) {
  if (arr.length === 0) return null;
  return Math.round(arr.reduce((s, v) => s + v, 0) / arr.length);
}

function statsObj(arr) {
  if (arr.length === 0) return null;
  return {
    min: Math.min(...arr),
    p50: p(arr, 0.5),
    p90: p(arr, 0.9),
    p95: p(arr, 0.95),
    max: Math.max(...arr),
    avg: avg(arr)
  };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── 运行 ──
main().catch(console.error);
