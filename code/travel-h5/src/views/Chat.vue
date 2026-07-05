<template>
    <div class="page-container chat-page">
        <div class="page-header">
            <van-nav-bar title="AI旅游助手"
             left-arrow
             left-text="返回"
              @click-left="onBack" />
        </div>
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
                <ChatBubble v-for="msg in messages" :key="msg.id" :message="msg" /> 
                <div class="streaming-indicator" v-if="isStreaming">
                    <van-loading type="spinner" size="20px"/>
                    <span>AI正在思考中...</span>
                </div>
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
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { fetchStream } from '../utils/request'
import { showToast } from 'vant'
import ChatBubble from '../components/ChatBubble.vue'

const router = useRouter()

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



//对话数据
const messages = ref([])
//输入框内容
const inputMessage = ref('')
//AI处理中
const isStreaming = ref(false)

//发送消息
const sendMessage = () => {
    const msg = inputMessage.value.trim()
    if(!msg || isStreaming.value){
        return
    }
    addUserMessage(msg)
    inputMessage.value = ''
    //运行流式请求yy
    fetchAIResponse(msg)
    
}

//获取AI响应
const fetchAIResponse = (userMsg) => {
    isStreaming.value = true
    messages.value.push({
        id: Date.now() + 1,
        role: 'AI',
        content: '',
        timestamp: new Date().toISOString()
    })
    let fullResponse = ''
    fetchStream('chat', { message: userMsg }, (chunk) => {
        fullResponse += chunk
        const lastMessage = messages.value[messages.value.length - 1]
        if(lastMessage && lastMessage.role === 'AI'){
            lastMessage.content = fullResponse
        }
        scrollToBottom()
    }, () => {
        //AI返回完成
        isStreaming.value = false
        scrollToBottom()
    }, (errorMsg) => {
        //AI返回错误
        const lastMessage = messages.value[messages.value.length - 1]
        if(lastMessage && lastMessage.role === 'AI'){
            lastMessage.content = `抱歉，AI发生错误:${errorMsg}`
        }
        isStreaming.value = false
        showToast('AI处理错误，请稍后重试')
        scrollToBottom()
    })
}

const onBack = () => {
  router.back()
}

//用户发送消息
const addUserMessage = (content) => {
  messages.value.push({
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
}

.chat-container {
  height: 600px;
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
  color: #999;
  margin-bottom: 16px;
}

.quick-tag {
  margin: 8px;
  cursor: pointer;
}

.messages-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.streaming-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  color: #999;
  font-size: 14px;
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
  background: #f7f8fa;
  border-radius: 20px;
  padding: 8px 16px;
}
</style>

