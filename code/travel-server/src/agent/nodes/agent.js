import { SystemMessage } from '@langchain/core/messages';
import { SYSTEM_PROMPT } from '../prompts/system.js';
import { TOOLS, getToolDescriptions } from '../tools/registry.js';
import { MAX_ITERATIONS } from '../state.js';

/**
 * Agent 推理节点
 * 调用 LLM（绑定工具），由模型自行决定是调用工具还是直接回复
 *
 * ReAct 循环的核心节点：
 * - 首次进入：发送 system prompt + 对话历史 + 用户消息
 * - 工具调用后循环回来：消息中已包含工具结果，继续推理
 */
export async function agentNode(state, config) {
  const { messages, iteration } = state;
  const llm = config.configurable.llm;

  // 检查是否超过最大迭代次数
  if (iteration >= MAX_ITERATIONS) {
    return {
      status: 'finalizing',
      streamEvents: [
        { type: 'agent/thinking', node: 'agent', content: '已达到最大推理步数，正在生成回复...' }
      ]
    };
  }

  // 构建消息列表
  const systemMsg = new SystemMessage({
    content: SYSTEM_PROMPT + '\n\n## 可用工具\n' + getToolDescriptions()
  });

  const fullMessages = [systemMsg, ...messages];

  // 绑定工具的 LLM
  const llmWithTools = llm.bindTools(TOOLS);

  try {
    const response = await llmWithTools.invoke(fullMessages);
    const newMessages = [response];
    const events = [];

    // 检查 LLM 是否决定调用工具
    if (response.tool_calls && response.tool_calls.length > 0) {
      const toolNames = response.tool_calls.map(tc => tc.name).join(', ');

      // 去重检查：如果本次 tool_calls 与上一次完全相同，强制 finalize
      const prevAIMsg = [...messages].reverse().find(m => m._getType?.() === 'ai' && m.tool_calls?.length > 0);
      if (prevAIMsg && prevAIMsg.tool_calls) {
        const isDuplicate = response.tool_calls.length === prevAIMsg.tool_calls.length &&
          response.tool_calls.every((tc, i) =>
            tc.name === prevAIMsg.tool_calls[i]?.name &&
            JSON.stringify(tc.args) === JSON.stringify(prevAIMsg.tool_calls[i]?.args)
          );

        if (isDuplicate) {
          events.push({
            type: 'agent/thinking',
            node: 'agent',
            content: '工具已执行完毕，正在综合分析结果...'
          });
          return {
            messages: newMessages,
            iteration: iteration + 1,
            status: 'finalizing',
            streamEvents: events
          };
        }
      }

      events.push({
        type: 'agent/thinking',
        node: 'agent',
        content: `正在调用工具: ${toolNames}`,
        toolCalls: response.tool_calls.map(tc => ({
          name: tc.name,
          args: tc.args
        }))
      });

      return {
        messages: newMessages,
        iteration: iteration + 1,
        status: 'acting',
        streamEvents: events
      };
    }

    // LLM 决定直接回复（无工具调用）
    events.push({
      type: 'agent/thinking',
      node: 'agent',
      content: '分析完成，正在生成回复...'
    });

    return {
      messages: newMessages,
      iteration: iteration + 1,
      status: 'finalizing',
      streamEvents: events
    };
  } catch (err) {
    return {
      error: err.message,
      status: 'error',
      streamEvents: [
        { type: 'agent/error', node: 'agent', content: `推理出错: ${err.message}` }
      ]
    };
  }
}
