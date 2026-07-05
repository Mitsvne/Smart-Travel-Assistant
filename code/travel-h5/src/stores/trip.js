import { defineStore } from 'pinia'
import { reactive } from 'vue'

export const useTripStore = defineStore('trip', () => {
  //规划表单（Home页填写，切页后保留）
  const form = reactive({
    city: '',
    budget: null,
    days: null
  })

  //已生成的行程，按 city|budget|days 缓存，返回时命中缓存避免重复调用LLM
  const plans = reactive({})

  const planKey = (city, budget, days) => `${city}|${budget}|${days}`

  const getPlan = (city, budget, days) => plans[planKey(city, budget, days)]

  const setPlan = (city, budget, days, data) => {
    plans[planKey(city, budget, days)] = data
  }

  return { form, plans, getPlan, setPlan }
})
