import express from 'express';
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';
import { ChatOpenAI } from '@langchain/openai';
import { MemorySaver } from '@langchain/langgraph';
import { compileAgentGraph } from '../agent/graph.js';
import { TOOLS } from '../agent/tools/registry.js';
import { getKnowledgeRetriever } from '../agent/memory/knowledge.js';
import { createAgentStreamResponse } from '../utils/agentStreamUtils.js';
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

    for await (const chunk of graphStream) {
      lastState = chunk;

      // 处理每个 chunk 中的 streamEvents（只发送新增的）
      if (chunk.streamEvents && chunk.streamEvents.length > sentEventCount) {
        const newEvents = chunk.streamEvents.slice(sentEventCount);
        sentEventCount = chunk.streamEvents.length;
        for (const event of newEvents) {
          stream.sendEvent(event);
        }
      }
    }

    // 发送完成事件
    const finalResponse = lastState?.finalResponse || '';
    stream.sendDone({
      reply: finalResponse,
      threadId,
      status: lastState?.status || 'complete',
      toolResults: lastState?.toolResults || []
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

export default router;
