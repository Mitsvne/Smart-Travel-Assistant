<template>
    <div class="page-container chat-page">
        <div class="page-header">
            <van-nav-bar title="AI旅游助手"
             left-arrow
             left-text="返回"
              @click-left="onBack">
                <template #right>
                    <van-tag :type="useAgentMode ? 'primary' : 'default'" size="mini" @click="useAgentMode = !useAgentMode" style="margin-right:8px;cursor:pointer">
                        {{ useAgentMode ? 'Agent' : '普通' }}
                    </van-tag>
                    <van-icon name="notes-o" size="20" class="nav-action" @click="showHistory = true" />
                    <van-icon name="plus" size="20" class="nav-action" @click="onNewChat" />
                </template>
            </van-nav-bar>
        </div>

        <!-- 对话历史抽屉 -->
        <van-popup v-model:show="showHistory" position="right" :style="{ width: '78%', height: '100%' }">
            <div class="conv-drawer">
                <div class="conv-drawer-header">
                    <span class="conv-drawer-title">对话历史</span>
                    <van-button size="mini" type="primary" plain icon="plus" @click="onNewChat">新对话</van-button>
                </div>
                <van-empty v-if="conversations.length === 0" description="暂无对话历史" />
                <div v-else class="conv-list">
                    <div
                        class="conv-item"
                        :class="{ active: c.id === currentId }"
                        v-for="c in conversations"
                        :key="c.id"
                        @click="onSelectConversation(c.id)"
                    >
                        <div class="conv-item-body">
                            <div class="conv-item-title">{{ c.title }}</div>
                            <div class="conv-item-time">{{ formatTime(c.updatedAt) }}</div>
                        </div>
                        <van-icon name="delete-o" class="conv-item-delete" @click.stop="onDeleteConversation(c)" />
                    </div>
                </div>
            </div>
        </van-popup>
        <div class="chat-container" ref="chatContainer">
            <div v-if="messages.length === 0" class="chat-empty">
                <van-empty description="暂无对话记录" />
                <div class="quick-questions">
                    <div class="quick-title">快速问题</div>
                    <van-tag @click="handleClickTag(q)" v-for="q in quickQuestions" :key="q" size="large" mark class="quick-tag">
                        {{ q }}
                    </van-tag>
                </div>
            </div>
            <div v-else class="messages-list">
                <ChatBubble v-for="msg in messages" :key="msg.id" :message="msg" :isStreaming="isStreaming" /> 
            </div>
        </div>
        <div class="chat-input-area">
            <van-field 
            v-model="inputMessage" 
            placeholder="请输入" 
            :disabled="isStreaming"
            @keyup.enter="sendMessage"
            >
                <template #button>
                    <van-button type="primary" size="small" :disabled="!inputMessage.trim()" @click="sendMessage">发送</van-button>
                </template>
            </van-field>
        </div>
    </div>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { fetchStream, fetchAgentStream } from '../utils/request'
import { showToast, showConfirmDialog } from 'vant'
import ChatBubble from '../components/ChatBubble.vue'
import { useChatStore } from '../stores/chat'
import { storeToRefs } from 'pinia'

const router = useRouter()

const chatStore = useChatStore()
//对话数据（存于store并持久化，每轮对话为一条）
const { messages, conversations, currentId } = storeToRefs(chatStore)

//对话历史抽屉开关
const showHistory = ref(false)

//格式化时间戳
const formatTime = (ts) => {
    const d = new Date(ts)
    const pad = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

//新建一轮空白对话（当前已是空白对话则不重复创建）
const onNewChat = () => {
    const cur = chatStore.currentConversation
    if (!cur || cur.messages.length > 0) {
        chatStore.newConversation()
    }
    inputMessage.value = ''
    showHistory.value = false
}

//切换到某轮历史对话
const onSelectConversation = (id) => {
    chatStore.switchConversation(id)
    showHistory.value = false
    nextTick(scrollToBottom)
}

//删除某轮对话（二次确认）
const onDeleteConversation = (c) => {
    showConfirmDialog({
        title: '删除对话',
        message: `确定删除「${c.title}」吗？`
    })
        .then(() => {
            chatStore.removeConversation(c.id)
            showToast('已删除')
        })
        .catch(() => {})
}

//聊天容器
const chatContainer = ref(null)
//置底方法
const scrollToBottom = () => {
    if(chatContainer.value){
        chatContainer.value.scrollTop = chatContainer.value.scrollHeight
    }
}


//常见问题
const quickQuestions = ref([
  '北京有哪些必去的景点？',
  '上海美食推荐',
  '成都三日游攻略',
  '如何选择旅行保险？'
])

//点击常见问题
const handleClickTag = (q) => {
  inputMessage.value = q
}



//输入框内容
const inputMessage = ref('')
//AI处理中
const isStreaming = ref(false)
//Agent 模式开关
const useAgentMode = ref(true)

//发送消息
const sendMessage = () => {
    const msg = inputMessage.value.trim()
    if(!msg || isStreaming.value){
        return
    }
    addUserMessage(msg)
    inputMessage.value = ''
    //根据模式选择接口
    if (useAgentMode.value) {
        fetchAgentResponse(msg)
    } else {
        fetchAIResponse(msg)
    }
}

//单次请求携带的最大历史消息数（控制token）
const MAX_HISTORY = 20

//获取AI响应（原版，向后兼容）
const fetchAIResponse = (userMsg) => {
    isStreaming.value = true

    // ── 客户端延迟计时 ──
    const clientTiming = {
        sendTime: performance.now(),
        firstChunkTime: null,
        completeTime: null,
        chunkCount: 0
    }

    //本轮之前的历史消息（不含刚添加的用户消息），作为上下文记忆发给后端
    const history = messages.value
        .slice(0, -1)
        .filter(m => m.content && String(m.content).trim())
        .slice(-MAX_HISTORY)
        .map(m => ({ role: m.role === 'AI' ? 'assistant' : 'user', content: m.content }))
    //占位的AI消息，捕获引用以便持续写入（避免切换会话时写错对话）
    const aiMessage = chatStore.addMessage({
        id: Date.now() + 1,
        role: 'AI',
        content: '',
        agentSteps: [],
        timestamp: new Date().toISOString()
    })
    let fullResponse = ''
    fetchStream('chat', { message: userMsg, history }, (chunk) => {
        // ── 记录首 token ──
        if (!clientTiming.firstChunkTime) {
            clientTiming.firstChunkTime = performance.now()
        }
        clientTiming.chunkCount++
        fullResponse += chunk
        aiMessage.content = fullResponse
        scrollToBottom()
    }, (data, serverLatency) => {
        //AI返回完成
        clientTiming.completeTime = performance.now()
        isStreaming.value = false

        // ── 输出延迟报告 ──
        const report = {
            mode: '普通',
            userMessage: userMsg.slice(0, 60),
            serverLatency: serverLatency || null,
            client: {
                ttftMs: clientTiming.firstChunkTime
                    ? Math.round(clientTiming.firstChunkTime - clientTiming.sendTime)
                    : null,
                totalMs: Math.round(clientTiming.completeTime - clientTiming.sendTime),
                chunkCount: clientTiming.chunkCount,
                timestamp: new Date().toISOString()
            }
        }
        console.log(
            '%c⏱ 普通模式延迟报告 %c[点击展开]',
            'font-weight:bold;color:#07c160',
            'color:#999;font-size:11px',
            report
        )

        scrollToBottom()
    }, (errorMsg) => {
        //AI返回错误
        aiMessage.content = `抱歉，AI发生错误:${errorMsg}`
        isStreaming.value = false
        showToast('AI处理错误，请稍后重试')
        scrollToBottom()
    })
}

//获取Agent响应（新增）
const fetchAgentResponse = (userMsg) => {
    isStreaming.value = true

    // ── 客户端延迟计时 ──
    const clientTiming = {
        sendTime: performance.now(),      // 浏览器发送时间
        firstChunkTime: null,             // 首个 token 到达时间
        firstThinkingTime: null,          // 首次思考事件到达
        firstToolCallTime: null,          // 首次工具调用
        completeTime: null,               // 完成时间
        chunkCount: 0
    }

    //本轮之前的历史消息
    const history = messages.value
        .slice(0, -1)
        .filter(m => m.content && String(m.content).trim())
        .slice(-MAX_HISTORY)
        .map(m => ({ role: m.role === 'AI' ? 'assistant' : 'user', content: m.content }))
    //占位的AI消息
    const aiMessage = chatStore.addMessage({
        id: Date.now() + 1,
        role: 'AI',
        content: '',
        agentSteps: [],
        timestamp: new Date().toISOString()
    })

    // Agent 步骤追踪
    const stepMap = new Map() // toolCallId → step

    fetchAgentStream(
        { message: userMsg, history },
        {
            // Agent 思考
            onThinking: (data) => {
                if (!clientTiming.firstThinkingTime) {
                    clientTiming.firstThinkingTime = performance.now()
                }
                const step = {
                    id: Date.now() + Math.random(),
                    type: 'thinking',
                    content: data.content,
                    node: data.node,
                    status: 'done',
                    timestamp: data.timestamp
                }
                aiMessage.agentSteps.push(step)
                scrollToBottom()
            },
            // 工具调用开始
            onToolCall: (data) => {
                if (!clientTiming.firstToolCallTime) {
                    clientTiming.firstToolCallTime = performance.now()
                }
                const step = {
                    id: data.id || (Date.now() + Math.random()),
                    type: 'tool_call',
                    tool: data.tool,
                    args: data.args,
                    status: 'running',
                    timestamp: data.timestamp
                }
                aiMessage.agentSteps.push(step)
                stepMap.set(data.id, step)
                scrollToBottom()
            },
            // 工具调用结果
            onToolResult: (data) => {
                const step = stepMap.get(data.id)
                if (step) {
                    step.status = data.success ? 'done' : 'error'
                    step.result = data.result
                    step.duration = data.duration
                    step.success = data.success
                }
                scrollToBottom()
            },
            // 流式回复
            onChunk: (content) => {
                // ── 记录首 token 时间 ──
                if (!clientTiming.firstChunkTime) {
                    clientTiming.firstChunkTime = performance.now()
                }
                clientTiming.chunkCount++
                aiMessage.content += content
                scrollToBottom()
            },
            // 完成
            onComplete: (data) => {
                clientTiming.completeTime = performance.now()
                isStreaming.value = false
                if (!aiMessage.content && data.data?.reply) {
                    aiMessage.content = data.data.reply
                }

                // ── 输出延迟报告到控制台 ──
                const report = {
                    userMessage: userMsg.slice(0, 60),
                    // 服务端数据
                    serverLatency: data.data?.latency || null,
                    // 客户端数据
                    client: {
                        ttftMs: clientTiming.firstChunkTime
                            ? Math.round(clientTiming.firstChunkTime - clientTiming.sendTime)
                            : null,
                        thinkingMs: clientTiming.firstThinkingTime
                            ? Math.round(clientTiming.firstThinkingTime - clientTiming.sendTime)
                            : null,
                        firstToolMs: clientTiming.firstToolCallTime
                            ? Math.round(clientTiming.firstToolCallTime - clientTiming.sendTime)
                            : null,
                        totalMs: Math.round(clientTiming.completeTime - clientTiming.sendTime),
                        chunkCount: clientTiming.chunkCount,
                        timestamp: new Date().toISOString()
                    }
                }
                console.log(
                    '%c⏱ Agent 延迟报告 %c[点击展开]',
                    'font-weight:bold;color:#1989fa',
                    'color:#999;font-size:11px',
                    report
                )

                scrollToBottom()
            },
            // 错误
            onError: (errorMsg) => {
                clientTiming.completeTime = performance.now()
                aiMessage.content = aiMessage.content || `抱歉，Agent处理出错: ${errorMsg}`
                isStreaming.value = false
                showToast('Agent处理错误，请稍后重试')
                scrollToBottom()
            }
        }
    )
}

const onBack = () => {
  router.back()
}

//用户发送消息
const addUserMessage = (content) => {
  chatStore.addMessage({
    id: Date.now(),
    role: 'user',
    content,
    timestamp: new Date().toISOString()
  })
}

const route = useRoute()
onMounted(() => {
    if(route.query.scene === 'detail' && route.query.city){
       inputMessage.value = `你好，我想知道${route.query.city}有哪些必去的景点？`
    }
})


</script>







<style scoped>
.page-header{
    height: 46px;
}
.chat-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  padding-bottom: 0px !important;
  background: #f2f4f8;
}

/* 渐变导航栏 */
:deep(.van-nav-bar) {
  background: linear-gradient(135deg, #1989fa 0%, #36cbcb 100%);
}
:deep(.van-nav-bar)::after {
  display: none;
}
:deep(.van-nav-bar__title),
:deep(.van-nav-bar__text) {
  color: #fff;
}
:deep(.van-nav-bar .van-icon) {
  color: #fff;
}

.nav-action {
  margin-left: 16px;
  cursor: pointer;
}

/* 对话历史抽屉 */
.conv-drawer {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #f2f4f8;
}
.conv-drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  font-size: 16px;
  font-weight: 600;
  color: #323233;
  background: #fff;
  box-shadow: 0 2px 8px rgba(31, 45, 61, 0.05);
}
.conv-list {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.conv-item {
  display: flex;
  align-items: center;
  padding: 12px 14px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 4px 14px rgba(31, 45, 61, 0.05);
  cursor: pointer;
  transition: transform 0.2s;
}
.conv-item:active {
  transform: translateY(1px);
}
.conv-item.active {
  border: 1px solid #1989fa;
  background: rgba(25, 137, 250, 0.06);
}
.conv-item-body {
  flex: 1;
  min-width: 0;
}
.conv-item-title {
  font-size: 15px;
  font-weight: 500;
  color: #323233;
  margin-bottom: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.conv-item-time {
  font-size: 12px;
  color: #969799;
}
.conv-item-delete {
  color: #ee0a24;
  font-size: 18px;
  padding: 6px;
  flex-shrink: 0;
}

.chat-container {
  height: 550px;
  overflow-y: auto;
  padding: 16px;
  padding-bottom: 60px;
}

.chat-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
}

.quick-questions {
  margin-top: 32px;
  text-align: center;
}

.quick-title {
  font-size: 14px;
  color: #969799;
  margin-bottom: 16px;
}

.quick-tag {
  margin: 6px;
  padding: 8px 16px !important;
  border-radius: 20px !important;
  background: #fff !important;
  color: #1989fa !important;
  font-size: 14px !important;
  border: none !important;
  box-shadow: 0 2px 8px rgba(31, 45, 61, 0.08);
  cursor: pointer;
}

.messages-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.chat-input-area {
  position: fixed;
  bottom: 50px;
  left: 0;
  right: 0;
  background: #fff;
  padding: 8px 16px;
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.05);
  max-width: 750px;
  margin: 0 auto;
}

.chat-input-area :deep(.van-field) {
  background: #f2f4f8;
  border-radius: 20px;
  padding: 8px 16px;
}

.chat-input-area :deep(.van-button--primary) {
  border: none;
  border-radius: 16px;
  padding: 0 16px;
  background: linear-gradient(135deg, #1989fa 0%, #36cbcb 100%);
}
</style>

