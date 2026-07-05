import { defineStore } from 'pinia'
import { ref } from 'vue'

const STORAGE_KEY = 'travel_history'
const MAX_RECORDS = 50

const load = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch (e) {
    return []
  }
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
    return records.value.find(r => r.key === k)
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

  return { records, getRecord, addRecord }
})
