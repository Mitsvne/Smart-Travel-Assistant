import { SystemMessage, HumanMessage, AIMessage } from '@langchain/core/messages';
import { FINALIZER_PROMPT } from '../prompts/synthesizer.js';

/**
 * Finalize 节点
 * 综合所有工具结果和对话历史，生成最终回复
 * 此节点将消息转为纯文本上下文（避免 tool_call/tool_message 配对问题）
 */
export async function finalizeNode(state, config) {
  const { messages, userMessage, toolResults, error } = state;
  const llm = config.configurable.llm;

  const events = [];

  // 收集工具结果摘要
  const toolResultsText = toolResults.length > 0
    ? toolResults.map(
        (tr, i) =>
          `${i + 1}. ${tr.tool}(${JSON.stringify(tr.args)}) → ${tr.success ? '成功' : '失败'}: ${typeof tr.result === 'string' ? tr.result.slice(0, 500) : ''}`
      ).join('\n')
    : '无工具调用';

  // 构建纯文本上下文（避免消息中的 tool_call 配对问题）
  const prompt = FINALIZER_PROMPT
    .replace('{userMessage}', userMessage)
    .replace('{allObservations}', toolResultsText);

  // 提取对话历史为纯文本，跳过带 tool_calls 的消息
  const conversationLines = [];
  for (const msg of messages) {
    const type = msg._getType?.();
    if (type === 'human') {
      conversationLines.push(`用户: ${msg.content}`);
    } else if (type === 'ai' && !msg.tool_calls?.length && msg.content) {
      conversationLines.push(`助手: ${msg.content}`);
    } else if (type === 'tool') {
      // 工具结果已在 toolResultsText 中，跳过
      continue;
    }
    // 跳过带 tool_calls 的 ai 消息
  }

  const contextMessages = [
    new SystemMessage(prompt),
    new HumanMessage(`对话记录:\n${conversationLines.join('\n')}\n\n请基于以上信息和工具执行结果回答用户的问题。`)
  ];

  // 流式生成回复
  try {
    const stream = await llm.stream(contextMessages);
    let fullResponse = '';

    for await (const chunk of stream) {
      const content = chunk.content || '';
      if (content) {
        fullResponse += content;
        events.push({
          type: 'agent/chunk',
          content
        });
      }
    }

    events.push({
      type: 'agent/done',
      finalResponse: fullResponse
    });

    return {
      messages: [new AIMessage({ content: fullResponse })],
      finalResponse: fullResponse,
      status: 'complete',
      streamEvents: events
    };
  } catch (err) {
    // 降级：如果流式失败，使用非流式调用
    try {
      const fallback = await llm.invoke(contextMessages);
      const content = fallback.content || '';
      events.push({
        type: 'agent/chunk',
        content
      });
      events.push({
        type: 'agent/done',
        finalResponse: content
      });
      return {
        messages: [new AIMessage({ content })],
        finalResponse: content,
        status: 'complete',
        streamEvents: events
      };
    } catch (err2) {
      const fallbackMsg = `抱歉，生成回复时遇到错误: ${err2.message}。请稍后重试。`;
      events.push({
        type: 'agent/done',
        finalResponse: fallbackMsg
      });
      return {
        messages: [new AIMessage({ content: fallbackMsg })],
        finalResponse: fallbackMsg,
        status: 'complete',
        error: err2.message,
        streamEvents: events
      };
    }
  }
}
