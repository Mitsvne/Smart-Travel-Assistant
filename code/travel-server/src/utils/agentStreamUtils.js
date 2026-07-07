/**
 * Agent SSE 流式响应工具
 * 扩展自 streamUtils.js，支持 agent 事件的类型化发送
 */

/**
 * 创建 Agent 流式响应上下文
 * @param {Response} res - Express response 对象
 */
export function createAgentStreamResponse(res) {
  // SSE 响应头
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // 禁用 nginx 缓冲

  let ended = false;

  /**
   * 发送单个 SSE 事件
   */
  function sendEvent(data) {
    if (ended) return;
    try {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (err) {
      console.error('SSE send error:', err.message);
      ended = true;
    }
  }

  return {
    /** Agent 思考状态 */
    sendThinking: (node, content) => {
      sendEvent({ type: 'agent/thinking', node, content, timestamp: Date.now() });
    },

    /** 工具调用开始 */
    sendToolCall: (tool, args, id) => {
      sendEvent({ type: 'agent/tool_call', tool, args, id, timestamp: Date.now() });
    },

    /** 工具调用结果 */
    sendToolResult: (tool, result, success, duration, id) => {
      sendEvent({
        type: 'agent/tool_result',
        tool,
        result: typeof result === 'string' ? result.slice(0, 500) : result, // 前端只显示摘要
        success,
        duration,
        id,
        timestamp: Date.now()
      });
    },

    /** 最终回复的 token 块 */
    sendChunk: (content) => {
      sendEvent({ type: 'agent/chunk', content });
    },

    /** Agent 完成 */
    sendDone: (data) => {
      sendEvent({ type: 'agent/done', data, timestamp: Date.now() });
    },

    /** 错误事件 */
    sendError: (message, recoverable = false) => {
      sendEvent({ type: 'agent/error', message, recoverable, timestamp: Date.now() });
    },

    /** 发送任意事件 */
    sendEvent,

    /** 关闭流 */
    end: () => {
      if (!ended) {
        try {
          res.write('event: end\ndata: {"done":true}\n\n');
          res.end();
        } catch (err) {
          console.error('SSE end error:', err.message);
        }
        ended = true;
      }
    }
  };
}
