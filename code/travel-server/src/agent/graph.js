import { StateGraph, START, END, MemorySaver } from '@langchain/langgraph';
import { AgentState, MAX_ITERATIONS } from './state.js';
import { agentNode } from './nodes/agent.js';
import { toolsNode } from './nodes/tools.js';
import { finalizeNode } from './nodes/finalize.js';

/**
 * 条件路由：根据最后一条消息是否有 tool_calls 决定下一步
 */
function routeAfterAgent(state) {
  const { messages, status, iteration } = state;

  // 超过最大迭代次数，强制结束
  if (iteration >= MAX_ITERATIONS) {
    return 'finalize';
  }

  // agent 节点已决定需要最终回复
  if (status === 'finalizing') {
    return 'finalize';
  }

  // 检查最后一条消息是否有工具调用
  const lastMsg = messages[messages.length - 1];
  if (lastMsg && lastMsg.tool_calls && lastMsg.tool_calls.length > 0) {
    return 'tools';
  }

  // 没有工具调用 → 最终回复
  return 'finalize';
}

/**
 * 工具执行后总是回到 agent（继续评估是否还需要更多工具调用）
 */
function routeAfterTools(state) {
  const { iteration } = state;
  if (iteration >= MAX_ITERATIONS) {
    return 'finalize';
  }
  return 'agent';
}

/**
 * 构建 Agent StateGraph
 *
 * 图结构:
 *   START → agent ──(有 tool_calls)──→ tools ──→ agent (循环)
 *               │                                    │
 *               └──(无 tool_calls 或超限)──→ finalize → END
 */
export function buildAgentGraph() {
  const workflow = new StateGraph(AgentState)
    // 注册节点
    .addNode('agent', agentNode)
    .addNode('tools', toolsNode)
    .addNode('finalize', finalizeNode)

    // 入口
    .addEdge(START, 'agent')

    // agent 节点的条件路由
    .addConditionalEdges('agent', routeAfterAgent, {
      tools: 'tools',
      finalize: 'finalize'
    })

    // 工具执行后条件路由
    .addConditionalEdges('tools', routeAfterTools, {
      agent: 'agent',
      finalize: 'finalize'
    })

    // 终点
    .addEdge('finalize', END);

  return workflow;
}

/**
 * 编译图（带 checkpoint 持久化）
 */
export function compileAgentGraph(checkpointer) {
  const workflow = buildAgentGraph();
  return workflow.compile({
    checkpointer: checkpointer || new MemorySaver()
  });
}

/**
 * 从 state 中提取流式事件并清空
 * SSE handler 在每次 node 完成后调用此方法
 */
export function drainStreamEvents(state) {
  const events = state.streamEvents || [];
  // 注意：我们不在这里清空 state，由 reducer 处理
  return events;
}
