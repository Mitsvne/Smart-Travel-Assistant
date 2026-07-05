import { defineStore } from 'pinia'
import { reactive } from 'vue'

export const useTripStore = defineStore('trip', () => {
  //规划表单（Home页填写，切页后保留）
  const form = reactive({
    city: '',
    budget: null,
    days: null
  })

  return { form }
})
