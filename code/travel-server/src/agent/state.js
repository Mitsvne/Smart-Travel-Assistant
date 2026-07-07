import { Annotation } from '@langchain/langgraph';

/**
 * AgentState — LangGraph 注解驱动的状态 schema
 * 贯穿 Plan → Act → Observe → Replan → Finalize 全流程
 */
export const AgentState = Annotation.Root({
  // ── 用户输入 ──
  userMessage: Annotation({
    default: () => '',
    reducer: (_, next) => next
  }),
  city: Annotation({
    default: () => null,
    reducer: (_, next) => next ?? null
  }),
  budget: Annotation({
    default: () => null,
    reducer: (_, next) => next ?? null
  }),
  days: Annotation({
    default: () => null,
    reducer: (_, next) => next ?? null
  }),

  // ── 对话消息（LangChain BaseMessage 数组）──
  messages: Annotation({
    default: () => [],
    reducer: (prev, next) => prev.concat(next)
  }),

  // ── 执行计划 ──
  plan: Annotation({
    default: () => [],
    reducer: (_, next) => next
  }),
  currentStep: Annotation({
    default: () => null,
    reducer: (_, next) => next ?? null
  }),

  // ── 工具调用记录 ──
  toolResults: Annotation({
    default: () => [],
    reducer: (prev, next) => prev.concat(next)
  }),
  observations: Annotation({
    default: () => [],
    reducer: (prev, next) => prev.concat(next)
  }),

  // ── Agent 控制 ──
  iteration: Annotation({
    default: () => 0,
    reducer: (_, next) => next
  }),
  status: Annotation({
    default: () => 'planning',
    reducer: (_, next) => next
  }),
  error: Annotation({
    default: () => null,
    reducer: (_, next) => next
  }),

  // ── 最终输出 ──
  finalResponse: Annotation({
    default: () => null,
    reducer: (_, next) => next
  }),

  // ── 流式事件（每个 node 写入，SSE handler 消费后清空）──
  streamEvents: Annotation({
    default: () => [],
    reducer: (prev, next) => prev.concat(next)
  }),

  // ── RAG 检索结果 ──
  relevantDocs: Annotation({
    default: () => [],
    reducer: (_, next) => next
  }),

  // ── 会话标识 ──
  threadId: Annotation({
    default: () => null,
    reducer: (_, next) => next ?? null
  })
});

/** 每轮 Agent 最大迭代次数，防止死循环 */
export const MAX_ITERATIONS = 10;

/** 工具调用超时（毫秒） */
export const TOOL_TIMEOUT_MS = 10000;
