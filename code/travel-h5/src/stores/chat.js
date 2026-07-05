import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useChatStore = defineStore('chat', () => {
  //对话记录（切页后保留）
  const messages = ref([])

  const addMessage = (msg) => {
    messages.value.push(msg)
  }

  const clear = () => {
    messages.value = []
  }

  return { messages, addMessage, clear }
})
