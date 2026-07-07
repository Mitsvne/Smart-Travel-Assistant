<template>
  <div class="chat-bubble" :class="messageClass">
    <div class="bubble-content">
      <!-- Agent 推理步骤（仅 AI 消息） -->
      <AgentSteps v-if="message.role !== 'user' && message.agentSteps && message.agentSteps.length > 0"
        :steps="message.agentSteps" />

      <div class="message-text" v-if="message.role === 'user'">{{ message.content }}</div>
      <div class="message-text ai-message" v-else>
        <template v-if="message.content">{{ message.content }}</template>
        <template v-else-if="isStreaming">
          <van-loading type="spinner" size="16" />
          <span class="streaming-text">AI 正在思考...</span>
        </template>
      </div>
    </div>
    <div class="message-time" v-if="showTime">{{ formatTime }}</div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import AgentSteps from './AgentSteps.vue'

const props = defineProps({
  message: {
    type: Object,
    required: true
  },
  isStreaming: {
    type: Boolean,
    default: false
  }
})

const messageClass = computed(() => {
  return props.message.role === 'user' ? 'user-message' : 'ai-message'
})

const showTime = computed(() => {
  return props.message.timestamp && props.message.content
})

const formatTime = computed(() => {
  if (!props.message.timestamp) return ''
  const date = new Date(props.message.timestamp)
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
})
</script>

<style scoped>
.chat-bubble {
  display: flex;
  flex-direction: column;
  max-width: 85%;
}

.user-message {
  align-self: flex-end;
  align-items: flex-end;
}

.ai-message {
  align-self: flex-start;
  align-items: flex-start;
}

.bubble-content {
  padding: 12px 16px;
  border-radius: 16px;
  font-size: 15px;
  line-height: 1.5;
  word-break: break-word;
}

.user-message .bubble-content {
  background: linear-gradient(135deg, #1989fa 0%, #36cbcb 100%);
  color: #fff;
  border-bottom-right-radius: 4px;
  box-shadow: 0 4px 10px rgba(25, 137, 250, 0.25);
}

.ai-message .bubble-content {
  background: #fff;
  color: #323233;
  border-bottom-left-radius: 4px;
  box-shadow: 0 2px 8px rgba(31, 45, 61, 0.06);
}

.message-time {
  font-size: 11px;
  color: #999;
  margin-top: 4px;
  padding: 0 4px;
}

.streaming-text {
  color: #969799;
  margin-left: 6px;
  font-size: 14px;
}
</style>
