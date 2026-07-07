import axios from 'axios'
//创建axios实例
const request = axios.create({
    baseURL: 'http://127.0.0.1:3000/api/travel',
    timeout: 60000,
    headers: {
        'Content-Type': 'application/json'
    }
})

//封装拦截器
request.interceptors.request.use(
    config => {
        return config
    },
    error => {
        return Promise.reject(error)
    }
)

//封装响应拦截器
request.interceptors.response.use(
    response => {
        return response.data
    },
    error => {
        return Promise.reject(error)
    }
)

export function post(url, data) {
    return request.post(url, data)
}

export function get(url, params) {
    return request.get(url, { params })
}

//创建流式接口（原版，向后兼容）
export async function fetchStream(url, data, onChunk, onComplete, onError) {
    const controller = new AbortController()

    try {
        const response = await fetch(`http://127.0.0.1:3000/api/travel/${url}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
            signal: controller.signal
        })
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        while (true) {
            const { done, value } = await reader.read()
            if (done) break
            const chunk = decoder.decode(value, { stream: true })
            const lines = chunk.split('\n').filter(line => line.trim())
            for (const line of lines) {
                console.log(line)
                try {
                    if (line.startsWith('data: ')) {
                        const jsonStr = line.substring(6)
                        const jsonData = JSON.parse(jsonStr)
                        if (jsonData.type === 'chunk') {
                            onChunk(jsonData.content)
                        } else if (jsonData.done) {
                            onComplete(jsonData.data)
                        } else if (jsonData.error) {
                            onError(jsonData.error)
                        }
                    }
                } catch (error) {
                    onError("流式解析数据失败")
                }
            }
        }
        return controller.abort()
    } catch (error) {
        onError(error.message)
    }
}

/**
 * Agent 流式接口
 * 支持 agent 事件类型: agent/thinking, agent/tool_call, agent/tool_result, agent/chunk, agent/done, agent/error
 *
 * @param {object} callbacks - { onThinking, onToolCall, onToolResult, onChunk, onComplete, onError }
 * @returns {function} abort controller
 */
export async function fetchAgentStream(data, callbacks) {
    const controller = new AbortController()
    const { onThinking, onToolCall, onToolResult, onChunk, onComplete, onError } = callbacks

    try {
        const response = await fetch('http://127.0.0.1:3000/api/travel/agent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
            signal: controller.signal
        })
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        while (true) {
            const { done, value } = await reader.read()
            if (done) break
            const chunk = decoder.decode(value, { stream: true })
            const lines = chunk.split('\n').filter(line => line.trim())
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    try {
                        const jsonStr = line.substring(6)
                        const jsonData = JSON.parse(jsonStr)
                        switch (jsonData.type) {
                            case 'agent/thinking':
                                onThinking && onThinking(jsonData)
                                break
                            case 'agent/tool_call':
                                onToolCall && onToolCall(jsonData)
                                break
                            case 'agent/tool_result':
                                onToolResult && onToolResult(jsonData)
                                break
                            case 'agent/chunk':
                                onChunk && onChunk(jsonData.content)
                                break
                            case 'agent/done':
                                onComplete && onComplete(jsonData)
                                break
                            case 'agent/error':
                                onError && onError(jsonData.message || jsonData.content)
                                break
                        }
                    } catch (e) {
                        console.warn('Agent SSE parse error:', e)
                    }
                }
            }
        }
        return controller.abort()
    } catch (error) {
        onError && onError(error.message)
    }
}