import express from 'express';
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';
import { ChatOpenAI } from '@langchain/openai';
import { MemorySaver } from '@langchain/langgraph';
import { compileAgentGraph } from '../agent/graph.js';
import { TOOLS } from '../agent/tools/registry.js';
import { getKnowledgeRetriever } from '../agent/memory/knowledge.js';
import { createAgentStreamResponse } from '../utils/agentStreamUtils.js';
import { createTrace, markAgentThink, markToolCallStart, markToolCallEnd, markFirstToken, markDone, getRecentRecords, getLatencyStats, clearRecords } from '../utils/latencyTracker.js';
import 'dotenv/config';

const router = express.Router();

// ── LLM 实例（单例）──
function createLLM() {
  return new ChatOpenAI({
    apiKey: process.env.LLM_API_KEY,
    model: process.env.LLM_MODEL || 'deepseek-v4-flash',
    configuration: {
      baseURL: process.env.LLM_BASE_URL || 'https://api.deepseek.com/v1'
    },
    temperature: 0.5,
    streaming: true
  });
}

// ── Checkpoint 存储（内存）──
const checkpointers = new Map(); // threadId → MemorySaver

function getCheckpointer(threadId) {
  if (!checkpointers.has(threadId)) {
    checkpointers.set(threadId, new MemorySaver());
  }
  return checkpointers.get(threadId);
}

// ── 将前端历史消息转为 LangChain 消息 ──
function convertHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .filter(h => h && h.content)
    .map(h => {
      if (h.role === 'assistant' || h.role === 'AI') {
        return new AIMessage({ content: h.content });
      }
      return new HumanMessage({ content: h.content });
    });
}

/**
 * POST /api/travel/agent
 *
 * Agent 流式端点
 * 请求体: { message, history?, threadId?, preferences? }
 * 响应: SSE stream
 */
router.post('/agent', async (req, res) => {
  const { message, history, threadId: clientThreadId, preferences } = req.body;

  if (!message || !message.trim()) {
    return res.status(400).json({
      success: false,
      message: '请提供消息内容'
    });
  }

  // 创建 SSE 流
  const stream = createAgentStreamResponse(res);

  try {
    // 初始化
    const threadId = clientThreadId || `thread_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // ── 延迟追踪：创建 trace ──
    const trace = createTrace(threadId, message);
    const llm = createLLM();
    const checkpointer = getCheckpointer(threadId);

    // 编译图
    const agentGraph = compileAgentGraph(checkpointer);

    // 构建初始消息
    const historyMsgs = convertHistory(history);
    const userMsg = new HumanMessage({ content: message });

    // 如果有偏好设置，注入 system 消息
    const allMessages = [];
    if (preferences) {
      const prefStr = Object.entries(preferences)
        .map(([k, v]) => `- ${k}: ${v}`)
        .join('\n');
      if (prefStr) {
        allMessages.push(
          new SystemMessage({
            content: `## 用户偏好\n${prefStr}\n请根据用户偏好调整建议。`
          })
        );
      }
    }
    allMessages.push(...historyMsgs, userMsg);

    // 初始状态
    const initialState = {
      userMessage: message,
      messages: allMessages,
      threadId
    };

    stream.sendThinking('agent', '正在分析你的需求...');

    // 流式运行 Agent 图
    let lastState = null;
    let sentEventCount = 0; // 追踪已发送事件数，避免重复

    const graphStream = await agentGraph.stream(
      initialState,
      {
        configurable: {
          thread_id: threadId,
          llm
        },
        streamMode: 'values'
      }
    );

    let firstTokenMarked = false;
    let chunkCount = 0;

    for await (const chunk of graphStream) {
      lastState = chunk;

      // 处理每个 chunk 中的 streamEvents（只发送新增的）
      if (chunk.streamEvents && chunk.streamEvents.length > sentEventCount) {
        const newEvents = chunk.streamEvents.slice(sentEventCount);
        sentEventCount = chunk.streamEvents.length;
        for (const event of newEvents) {
          // ── 延迟追踪：各阶段计时 ──
          if (event.type === 'agent/thinking') {
            markAgentThink(threadId, event.content);
          } else if (event.type === 'agent/tool_call') {
            markToolCallStart(threadId, event.tool, event.args);
          } else if (event.type === 'agent/tool_result') {
            markToolCallEnd(threadId, event.tool, event.success, event.duration);
          } else if (event.type === 'agent/chunk') {
            if (!firstTokenMarked) {
              firstTokenMarked = true;
              markFirstToken(threadId);
            }
            chunkCount++;
          }
          stream.sendEvent(event);
        }
      }
    }

    // ── 延迟追踪：完成 ──
    const summary = markDone(threadId);

    // 发送完成事件（附带延迟数据）
    const finalResponse = lastState?.finalResponse || '';
    stream.sendDone({
      reply: finalResponse,
      threadId,
      status: lastState?.status || 'complete',
      toolResults: lastState?.toolResults || [],
      latency: summary  // 附带服务端延迟数据，前端可展示
    });
    stream.end();
  } catch (err) {
    console.error('Agent error:', err);
    stream.sendError(err.message || 'Agent 处理出错', false);
    stream.end();
  }
});

/**
 * GET /api/travel/agent/status
 * 获取 Agent 当前状态（用于调试）
 */
router.get('/agent/status', (req, res) => {
  const kb = getKnowledgeRetriever();
  res.json({
    success: true,
    model: process.env.LLM_MODEL || 'deepseek-v4-flash',
    tools: TOOLS.map(t => t.name),
    toolsCount: TOOLS.length,
    knowledgeBase: {
      documents: kb.count,
      initialized: kb.initialized
    },
    activeCheckpoints: checkpointers.size,
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /api/travel/agent/latency-stats
 * 获取 Agent 延迟统计（聚合数据）
 */
router.get('/agent/latency-stats', (req, res) => {
  const stats = getLatencyStats();
  res.json({
    success: true,
    data: stats,
    note: stats
      ? '统计基于最近 100 条已完成请求。TTFT = 服务端收到请求 → 首个 LLM token 输出的时间。'
      : '暂无数据，请先发起 Agent 请求。'
  });
});

/**
 * GET /api/travel/agent/latency-records
 * 获取最近 N 条延迟明细
 */
router.get('/agent/latency-records', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 200);
  const records = getRecentRecords(limit);
  res.json({
    success: true,
    count: records.length,
    data: records
  });
});

/**
 * DELETE /api/travel/agent/latency-records
 * 清空延迟记录
 */
router.delete('/agent/latency-records', (req, res) => {
  clearRecords();
  res.json({ success: true, message: '延迟记录已清空' });
});

export default router;
