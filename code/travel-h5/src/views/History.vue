<template>
  <div class="page-container history-page">
    <div class="page-header">
      <van-nav-bar
        fixed
        title="历史记录"
        left-text="返回"
        left-arrow
        @click-left="onBack"
      />
    </div>
    <div class="page-content">
      <van-empty v-if="records.length === 0" description="暂无历史记录">
        <van-button type="primary" round @click="goHome">去规划行程</van-button>
      </van-empty>

      <div v-else class="history-list">
        <div
          class="history-item"
          v-for="record in records"
          :key="record.key"
          @click="goDetail(record)"
        >
          <div class="item-icon">
            <van-icon name="location-o" />
          </div>
          <div class="item-body">
            <div class="item-title">{{ record.city }}·{{ record.days }}天行程</div>
            <div class="item-meta">
              <span class="item-budget">预算 ¥{{ record.budget }}</span>
              <span class="item-time">{{ formatTime(record.createdAt) }}</span>
            </div>
          </div>
          <van-icon name="arrow" class="item-arrow" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useHistoryStore } from '../stores/history'

const router = useRouter()
const historyStore = useHistoryStore()
const { records } = storeToRefs(historyStore)

//格式化时间戳
const formatTime = (ts) => {
  const d = new Date(ts)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

//进入对应详情页
const goDetail = (record) => {
  router.push({
    path: '/detail',
    query: {
      city: record.city,
      budget: record.budget,
      days: record.days
    }
  })
}

const goHome = () => {
  router.push('/')
}

const onBack = () => {
  router.back()
}
</script>

<style scoped>
.history-page {
  min-height: 100vh;
  background-color: #f2f4f8;
  padding-bottom: 24px;
}

.page-header {
  height: 46px;
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

.page-content {
  padding: 16px;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.history-item {
  display: flex;
  align-items: center;
  padding: 16px;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 6px 20px rgba(31, 45, 61, 0.06);
  cursor: pointer;
  transition: transform 0.2s;
}
.history-item:active {
  transform: translateY(2px);
}

.item-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  margin-right: 12px;
  font-size: 22px;
  color: #fff;
  background: linear-gradient(135deg, #1989fa, #36cbcb);
  flex-shrink: 0;
}

.item-body {
  flex: 1;
  min-width: 0;
}

.item-title {
  font-size: 16px;
  font-weight: 600;
  color: #323233;
  margin-bottom: 8px;
}

.item-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.item-budget {
  padding: 2px 10px;
  border-radius: 12px;
  font-size: 12px;
  color: #1989fa;
  background: rgba(25, 137, 250, 0.1);
}

.item-time {
  font-size: 12px;
  color: #969799;
}

.item-arrow {
  color: #c8c9cc;
  font-size: 16px;
  margin-left: 8px;
}
</style>
