import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'

const STORAGE_KEY = 'chat_conversations'
const MAX_CONVERSATIONS = 50

const load = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch (e) {
    return []
  }
}

export const useChatStore = defineStore('chat', () => {
  //所有对话（每轮对话为一条，持久化到localStorage）
  const conversations = ref(load())
  //当前激活对话的id
  const currentId = ref(conversations.value[0]?.id ?? null)

  const persist = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations.value))
  }
  watch(conversations, persist, { deep: true })

  //当前对话
  const currentConversation = computed(
    () => conversations.value.find(c => c.id === currentId.value) || null
  )
  //当前对话的消息（供Chat页面渲染）
  const messages = computed(() => currentConversation.value?.messages || [])

  //新建一轮空白对话并切换过去
  const newConversation = () => {
    const conv = {
      id: Date.now(),
      title: '新对话',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
    conversations.value.unshift(conv)
    currentId.value = conv.id
    if (conversations.value.length > MAX_CONVERSATIONS) {
      conversations.value = conversations.value.slice(0, MAX_CONVERSATIONS)
    }
    return conv
  }

  //切换到指定对话
  const switchConversation = (id) => {
    currentId.value = id
  }

  //删除指定对话
  const removeConversation = (id) => {
    const idx = conversations.value.findIndex(c => c.id === id)
    if (idx !== -1) {
      conversations.value.splice(idx, 1)
      if (currentId.value === id) {
        currentId.value = conversations.value[0]?.id ?? null
      }
    }
  }

  //向当前对话追加消息（无当前对话时自动新建），返回存入的响应式消息对象
  const addMessage = (msg) => {
    if (!currentConversation.value) {
      newConversation()
    }
    const conv = currentConversation.value
    conv.messages.push(msg)
    //首条用户消息作为对话标题
    if (msg.role === 'user' && conv.title === '新对话') {
      conv.title = String(msg.content).slice(0, 20)
    }
    conv.updatedAt = Date.now()
    return conv.messages[conv.messages.length - 1]
  }

  const clear = () => {
    conversations.value = []
    currentId.value = null
  }

  return {
    conversations,
    currentId,
    currentConversation,
    messages,
    newConversation,
    switchConversation,
    removeConversation,
    addMessage,
    clear
  }
})
