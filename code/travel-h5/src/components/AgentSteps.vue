<template>
  <div class="agent-steps" v-if="steps.length > 0">
    <div class="steps-header" @click="collapsed = !collapsed">
      <span class="steps-title">
        <van-icon :name="collapsed ? 'arrow' : 'arrow-down'" size="12" />
        Agent 推理过程 ({{ steps.length }} 步)
      </span>
      <span class="steps-duration">{{ totalDuration }}ms</span>
    </div>
    <div class="steps-list" v-show="!collapsed">
      <div
        class="step-item"
        :class="'step-' + step.status"
        v-for="step in steps"
        :key="step.id"
      >
        <!-- 思考步骤 -->
        <div class="step-icon" v-if="step.type === 'thinking'">🧠</div>
        <!-- 工具调用 -->
        <div class="step-icon" v-else-if="step.type === 'tool_call'">🔧</div>
        <!-- 工具结果 -->
        <div class="step-icon" v-else-if="step.type === 'tool_result'">
          <span v-if="step.success">✅</span>
          <span v-else>❌</span>
        </div>

        <div class="step-body">
          <div class="step-label">
            <template v-if="step.type === 'thinking'">{{ step.content }}</template>
            <template v-else-if="step.type === 'tool_call'">
              调用工具: <strong>{{ step.tool }}</strong>
              <span class="step-args" v-if="step.args">
                ({{ formatArgs(step.args) }})
              </span>
            </template>
            <template v-else-if="step.type === 'tool_result'">
              {{ step.tool }} → {{ step.success ? '成功' : '失败' }}
              <span class="step-duration">{{ step.duration }}ms</span>
            </template>
          </div>
          <!-- 工具结果详情 -->
          <div class="step-detail" v-if="step.type === 'tool_result' && step.result">
            {{ formatResult(step.result) }}
          </div>
        </div>

        <!-- 运行中动画 -->
        <van-loading v-if="step.status === 'running'" size="14" type="spinner" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  steps: {
    type: Array,
    default: () => []
  }
})

const collapsed = ref(false)

const totalDuration = computed(() => {
  return props.steps.reduce((sum, s) => sum + (s.duration || 0), 0)
})

function formatArgs(args) {
  if (!args) return ''
  try {
    const s = JSON.stringify(args)
    return s.length > 60 ? s.slice(0, 60) + '...' : s
  } catch {
    return ''
  }
}

function formatResult(result) {
  if (!result) return ''
  if (typeof result === 'string') {
    try {
      const obj = JSON.parse(result)
      if (obj.summary) return obj.summary
      if (obj.breakdown) {
        return obj.breakdown.map(b => `${b.name}: ¥${b.cost}`).join(', ') +
          ` | 总计: ¥${obj.totalCost} | ${obj.advice || ''}`
      }
      return result.length > 200 ? result.slice(0, 200) + '...' : result
    } catch {
      return result.length > 200 ? result.slice(0, 200) + '...' : result
    }
  }
  return String(result).slice(0, 200)
}
</script>

<style scoped>
.agent-steps {
  margin-bottom: 8px;
  background: #f7f8fa;
  border-radius: 12px;
  overflow: hidden;
  font-size: 13px;
}

.steps-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  cursor: pointer;
  color: #646566;
  user-select: none;
}
.steps-header:active {
  background: #eef0f4;
}

.steps-title {
  display: flex;
  align-items: center;
  gap: 4px;
  font-weight: 500;
}

.steps-duration {
  font-size: 11px;
  color: #999;
}

.steps-list {
  padding: 0 12px 8px;
}

.step-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 6px 0;
  border-bottom: 1px solid #eef0f4;
}
.step-item:last-child {
  border-bottom: none;
}

.step-icon {
  flex-shrink: 0;
  width: 22px;
  text-align: center;
  font-size: 14px;
}

.step-body {
  flex: 1;
  min-width: 0;
}

.step-label {
  color: #323233;
  line-height: 1.5;
}

.step-args {
  color: #969799;
  font-size: 11px;
  word-break: break-all;
}

.step-duration {
  color: #999;
  font-size: 11px;
  margin-left: 6px;
}

.step-detail {
  margin-top: 4px;
  padding: 6px 8px;
  background: #fff;
  border-radius: 6px;
  color: #646566;
  font-size: 12px;
  line-height: 1.5;
  word-break: break-all;
}

.step-running .step-label {
  color: #1989fa;
}

.step-error .step-label {
  color: #ee0a24;
}
</style>
