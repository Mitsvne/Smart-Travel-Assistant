import { ToolMessage, HumanMessage } from '@langchain/core/messages';
import { toolByName } from '../tools/registry.js';
import { TOOL_TIMEOUT_MS } from '../state.js';

/**
 * 工具执行节点
 * 执行 LLM 请求的 tool_calls，返回 ToolMessage 数组
 *
 * 并行执行多个工具调用，单个失败不影响其他
 */
export async function toolsNode(state, config) {
  const { messages } = state;
  const lastMessage = messages[messages.length - 1];

  if (!lastMessage || !lastMessage.tool_calls || lastMessage.tool_calls.length === 0) {
    return {
      status: 'replanning',
      streamEvents: [
        { type: 'agent/thinking', node: 'tools', content: '没有待执行的工具调用' }
      ]
    };
  }

  const events = [];
  const toolMessages = [];
  const toolResults = [];

  // 并行执行所有工具调用
  const executions = lastMessage.tool_calls.map(async (toolCall) => {
    const tool = toolByName[toolCall.name];
    const startTime = Date.now();

    events.push({
      type: 'agent/tool_call',
      tool: toolCall.name,
      args: toolCall.args,
      id: toolCall.id
    });

    if (!tool) {
      const errMsg = `未知工具: ${toolCall.name}`;
      events.push({
        type: 'agent/tool_result',
        tool: toolCall.name,
        id: toolCall.id,
        result: errMsg,
        success: false,
        duration: 0
      });
      return {
        toolCallId: toolCall.id,
        content: JSON.stringify({ error: true, message: errMsg }),
        success: false
      };
    }

    try {
      const result = await tool.invoke(toolCall.args);
      const resultStr = typeof result === 'string' ? result : JSON.stringify(result);
      const duration = Date.now() - startTime;

      // 限制工具结果长度，避免 token 超限
      const truncated = resultStr.length > 4000
        ? resultStr.slice(0, 4000) + '...(结果已截断)'
        : resultStr;

      toolResults.push({
        tool: toolCall.name,
        args: toolCall.args,
        result: truncated,
        success: true,
        duration
      });

      events.push({
        type: 'agent/tool_result',
        tool: toolCall.name,
        id: toolCall.id,
        result: truncated.slice(0, 500), // SSE 中给摘要
        success: true,
        duration
      });

      return {
        toolCallId: toolCall.id,
        content: truncated,
        success: true
      };
    } catch (err) {
      const duration = Date.now() - startTime;
      const errMsg = `工具执行失败: ${err.message}`;

      toolResults.push({
        tool: toolCall.name,
        args: toolCall.args,
        result: errMsg,
        success: false,
        duration
      });

      events.push({
        type: 'agent/tool_result',
        tool: toolCall.name,
        id: toolCall.id,
        result: errMsg,
        success: false,
        duration
      });

      return {
        toolCallId: toolCall.id,
        content: JSON.stringify({ error: true, message: errMsg }),
        success: false
      };
    }
  });

  const results = await Promise.all(executions);

  // 构建 ToolMessage 数组
  for (const r of results) {
    toolMessages.push(new ToolMessage({
      content: r.content,
      tool_call_id: r.toolCallId
    }));
  }

  // 添加引导消息：工具已执行完毕，应基于结果回复
  const allSuccess = results.every(r => r.success);
  const guidance = allSuccess
    ? '所有工具已成功执行。请基于以上工具返回的真实数据，直接回答用户的问题。不要再次调用已经执行过的工具。'
    : '部分工具执行失败。请基于已有信息回答用户的问题，并诚实说明哪些信息获取失败。';

  toolMessages.push(new HumanMessage({ content: `[系统提示] ${guidance}` }));

  return {
    messages: toolMessages,
    toolResults,
    status: 'observing',
    streamEvents: events
  };
}
