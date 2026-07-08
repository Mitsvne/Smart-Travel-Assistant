import { defineStore } from 'pinia'
import { ref } from 'vue'

const STORAGE_KEY = 'travel_history'
const MAX_RECORDS = 50
const API_BASE = 'http://127.0.0.1:3000/api/travel'

const load = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch (e) {
    return []
  }
}

/**
 * 上报缓存事件到后端统计（fire-and-forget）
 */
function reportCacheEvent(hit, durationMs, key) {
  try {
    fetch(`${API_BASE}/cache-report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cache: 'trip_history', hit, durationMs, key })
    }).catch(() => {}) // 静默失败，不影响主流程
  } catch {}
}

export const useHistoryStore = defineStore('history', () => {
  //历史生成的行程（持久化到localStorage）
  const records = ref(load())

  const keyOf = (city, budget, days) => `${city}|${budget}|${days}`

  const persist = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records.value))
  }

  const getRecord = (city, budget, days) => {
    const k = keyOf(city, budget, days)
    const startTime = performance.now()
    const found = records.value.find(r => r.key === k)
    const duration = performance.now() - startTime

    if (found) {
      console.log(
        '%c💾 缓存命中 %c trip_history %c%s %c%.2fms',
        'color:#07c160;font-weight:bold',
        'color:#999',
        'color:#333',
        k,
        'color:#999',
        duration
      )
      reportCacheEvent(true, Math.round(duration), k)
    }
    return found
  }

  //删除一条记录
  const removeRecord = (key) => {
    const idx = records.value.findIndex(r => r.key === key)
    if (idx !== -1) {
      records.value.splice(idx, 1)
      persist()
    }
  }

  //新增/更新一条记录：相同行程去重并置顶
  const addRecord = (city, budget, days, data) => {
    const k = keyOf(city, budget, days)
    const idx = records.value.findIndex(r => r.key === k)
    if (idx !== -1) {
      records.value.splice(idx, 1)
    }
    records.value.unshift({
      key: k,
      city,
      budget,
      days,
      data,
      createdAt: Date.now()
    })
    if (records.value.length > MAX_RECORDS) {
      records.value = records.value.slice(0, MAX_RECORDS)
    }
    persist()
  }

  return { records, getRecord, addRecord, removeRecord }
})
