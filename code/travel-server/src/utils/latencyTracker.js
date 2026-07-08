/**
 * Agent 延迟追踪器
 *
 * 记录每次 Agent 请求的关键时间节点，支持：
 * - TTFT（Time to First Token）：用户请求 → 第一个 LLM token 输出
 * - 工具调用耗时
 * - 端到端总耗时
 *
 * 内存存储，服务重启后清空。最多保留最近 1000 条记录。
 */

const MAX_RECORDS = 1000;

/** @type {Array<{threadId: string, timestamps: object, toolCalls: object[], summary: object}>} */
const records = [];

/**
 * 创建一个新的延迟追踪会话
 */
export function createTrace(threadId, userMessage) {
  const trace = {
    threadId,
    userMessage: (userMessage || '').slice(0, 100), // 截断用于展示
    timestamps: {
      // 服务端收到请求
      serverStart: Date.now(),
      // Agent 节点各阶段
      agentFirstThink: null,
      firstToolCall: null,
      lastToolResult: null,
      // LLM 流式生成
      llmFirstToken: null,
      llmLastToken: null,
      // 完成
      done: null
    },
    toolCalls: [],      // { name, args, startTime, endTime, success }
    streamChunkCount: 0,
    toolCallCount: 0,
    iterationCount: 0
  };

  records.unshift(trace);
  if (records.length > MAX_RECORDS) {
    records.pop();
  }
  return trace;
}

/**
 * 根据 threadId 查找追踪记录
 */
function findTrace(threadId) {
  return records.find(r => r.threadId === threadId);
}

/**
 * 记录 Agent 首次思考
 */
export function markAgentThink(threadId, content) {
  const trace = findTrace(threadId);
  if (trace && !trace.timestamps.agentFirstThink) {
    trace.timestamps.agentFirstThink = Date.now();
  }
}

/**
 * 记录工具调用开始
 */
export function markToolCallStart(threadId, toolName, args) {
  const trace = findTrace(threadId);
  if (trace) {
    if (!trace.timestamps.firstToolCall) {
      trace.timestamps.firstToolCall = Date.now();
    }
    trace.toolCalls.push({ name: toolName, args, startTime: Date.now(), endTime: null, success: null });
    trace.toolCallCount++;
  }
}

/**
 * 记录工具调用结束
 */
export function markToolCallEnd(threadId, toolName, success, duration) {
  const trace = findTrace(threadId);
  if (trace) {
    const tc = trace.toolCalls.find(t => t.name === toolName && t.endTime === null);
    if (tc) {
      tc.endTime = Date.now();
      tc.success = success;
      tc.duration = duration;
    }
    trace.timestamps.lastToolResult = Date.now();
  }
}

/**
 * 记录 LLM 首个 token 输出（TTFT 的关键端点）
 */
export function markFirstToken(threadId) {
  const trace = findTrace(threadId);
  if (trace && !trace.timestamps.llmFirstToken) {
    trace.timestamps.llmFirstToken = Date.now();
  }
}

/**
 * 记录 LLM 流式结束
 */
export function markLastToken(threadId, chunkCount) {
  const trace = findTrace(threadId);
  if (trace) {
    trace.timestamps.llmLastToken = Date.now();
    trace.streamChunkCount = chunkCount;
  }
}

/**
 * 记录迭代次数
 */
export function markIteration(threadId, iteration) {
  const trace = findTrace(threadId);
  if (trace) {
    trace.iterationCount = iteration;
  }
}

/**
 * 记录请求完成并生成摘要
 */
export function markDone(threadId) {
  const trace = findTrace(threadId);
  if (trace) {
    trace.timestamps.done = Date.now();

    const t = trace.timestamps;

    // 计算各项指标
    trace.summary = {
      // 总耗时（服务端视角）
      totalMs: t.done - t.serverStart,

      // TTFT：首 token 时间（从服务端收到请求算起）
      // 如果有工具调用，TTFT 包含工具调用耗时
      ttftMs: t.llmFirstToken ? t.llmFirstToken - t.serverStart : null,

      // 纯 LLM 生成耗时（从首 token 到末 token）
      llmGenerationMs: (t.llmFirstToken && t.llmLastToken)
        ? t.llmLastToken - t.llmFirstToken : null,

      // 工具调用阶段耗时
      toolPhaseMs: (t.firstToolCall && t.lastToolResult)
        ? t.lastToolResult - t.firstToolCall : null,

      // Agent 思考阶段耗时（请求到达 → 首次工具调用或首次 token）
      thinkingMs: t.firstToolCall
        ? t.firstToolCall - t.serverStart
        : (t.llmFirstToken ? t.llmFirstToken - t.serverStart : null),

      // 统计
      toolCallCount: trace.toolCallCount,
      streamChunkCount: trace.streamChunkCount,
      iterationCount: trace.iterationCount,

      // 是否有工具调用
      hadToolCalls: trace.toolCallCount > 0,

      // 工具调用明细
      toolDetails: trace.toolCalls.map(tc => ({
        name: tc.name,
        duration: tc.duration,
        success: tc.success
      }))
    };

    return trace.summary;
  }
  return null;
}

/**
 * 获取最近 N 条延迟记录
 */
export function getRecentRecords(limit = 50) {
  return records.slice(0, limit).map(r => ({
    threadId: r.threadId,
    userMessage: r.userMessage,
    timestamps: r.timestamps,
    summary: r.summary
  }));
}

/**
 * 计算聚合延迟统计
 */
export function getLatencyStats() {
  const completed = records.filter(r => r.summary).slice(0, 100); // 最近 100 条
  if (completed.length === 0) return null;

  // 分组：有工具调用 vs 无工具调用
  const withTools = completed.filter(r => r.summary.hadToolCalls);
  const withoutTools = completed.filter(r => !r.summary.hadToolCalls);

  function calcPercentiles(arr) {
    if (arr.length === 0) return null;
    const sorted = [...arr].sort((a, b) => a - b);
    return {
      min: sorted[0],
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p90: sorted[Math.floor(sorted.length * 0.9)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
      max: sorted[sorted.length - 1],
      avg: Math.round(sorted.reduce((s, v) => s + v, 0) / sorted.length),
      count: sorted.length
    };
  }

  function buildGroupStats(group) {
    if (group.length === 0) return null;
    return {
      count: group.length,
      totalMs: calcPercentiles(group.map(r => r.summary.totalMs)),
      ttftMs: calcPercentiles(group.map(r => r.summary.ttftMs).filter(Boolean)),
      llmGenerationMs: calcPercentiles(group.map(r => r.summary.llmGenerationMs).filter(Boolean)),
      toolPhaseMs: calcPercentiles(group.map(r => r.summary.toolPhaseMs).filter(Boolean))
    };
  }

  return {
    totalRecords: records.length,
    completedRecords: completed.length,
    overall: buildGroupStats(completed),
    withToolCalls: buildGroupStats(withTools),
    withoutToolCalls: buildGroupStats(withoutTools),
    generatedAt: new Date().toISOString()
  };
}

/**
 * 清空所有记录
 */
export function clearRecords() {
  records.length = 0;
}
