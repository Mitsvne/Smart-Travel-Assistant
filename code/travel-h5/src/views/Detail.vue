<template>
    <div class="page-container">
        <div class="page-header">
            <van-nav-bar 
            fixed 
            left-text="返回" 
            left-arrow 
            @click-left="onBack" 
            :title="formData.city + '行程规划'" />
        </div>
        <div class="page-content">
            <div v-if="isLoading" class="loading-container">
                <van-loading  size="40" type="spinner">
                    正在生成旅游规划...
                </van-loading>
            </div>
            <div v-else-if="errorMsg">
                <van-empty :description="errorMsg">
                  <van-button type="primary" @click="fetchTravelData">
                    重新规划
                  </van-button>
                </van-empty>
            </div>
            <template v-else-if="tripData && tripData.success != false"> 
                <div class="card overview_card">
                  <div class="trip-header">
                    <h2>{{ formData.city }}·{{ formData.days }}天行程</h2>
                    <div class="trip-budget">预算：{{ formData.budget }}元</div>
                  </div>
                </div>
                <van-collapse v-model="activeDays">
                  <van-collapse-item 
                  v-for="day in tripData.dailyItinerary" 
                  :key="day.day" 
                  :title="'第' + day.day + '天'"
                  :name="day.day">
                  <div class="day-schedule">
                    <div class="schedule-section">
                      <div class="section-label morning">上午</div>
                      <SpotItem :data="day.morning" />
                    </div>
                    <div class="schedule-section">
                      <div class="section-label afternoon">下午</div>
                      <SpotItem :data="day.afternoon" />
                    </div>
                    <div class="schedule-section">
                      <div class="section-label evening">晚上</div>
                      <SpotItem :data="day.evening" />
                    </div>
                  </div>
                  </van-collapse-item>
                </van-collapse>
                <div class="card budget-card" v-if="tripData.budgetBreakdown">
                  <div class="section-title">
                    预算明细
                  </div>
                  <BudgetTable :data="tripData.budgetBreakdown" :total="formData.budget" />
                </div>
                <div class="card tips-card" v-if="tripData.tips && tripData.tips.length">
                  <div class="section-title">
                    温馨提示
                  </div>
                  <ul class="tips-list">
                    <li v-for="(tips, index) in tripData.tips" :key="index">{{ tips }}</li>
                  </ul>
                </div>
                <div class="card warnings-list" v-if="tripData.warnings && tripData.warnings.length">
                  <div class="section-title">
                    注意事项
                  </div>
                  <ul class="warnings-list">
                    <li v-for="(warnings, index) in tripData.warnings" :key="index">{{ warnings }}</li>
                  </ul>
                </div>
            </template>
        </div>
        <div class="detail-footer" v-if="tripData && tripData.success != false">
          <van-button type="primary" size="large" round @click="goToChat" class="primary-button">
            咨询AI助手
          </van-button>
        </div>
    </div>
</template>

<script setup>
import { onMounted, reactive , ref } from 'vue'
import { useRoute , useRouter} from 'vue-router'
import { post } from '../utils/request'
import SpotItem from '../components/SpotItem.vue'
import BudgetTable from '../components/BudgetTable.vue'



const route = useRoute()
const router = useRouter()
//加载状态
const isLoading = ref(true)
//表单数据
const formData = reactive({
  city: '',
  budget: null,
  days: null
})
//展开的天数
const activeDays = ref([])
const tripData = ref(null)
const errorMsg = ref('')
//获取旅游规划数据
const fetchTravelData=async()=>{
  isLoading.value = true
  errorMsg.value = ''
  try {
    const res = await post('recommend', {
      city: formData.city,
      budget: formData.budget,
      days: formData.days
    })
    if(res && res.success != false){
      tripData.value = res
    }else{
      errorMsg.value = '接口调用失败'
    }
  } catch (e) {
    errorMsg.value = '接口调用失败'
  } finally {
    isLoading.value = false
  }
}

//从路由参数读取行程信息
onMounted(() => {
  formData.city = route.query.city
  formData.budget = route.query.budget
  formData.days = route.query.days
  if(formData.city && formData.budget && formData.days) {
    fetchTravelData()
  }
})

//返回上一页
const onBack = () => {
  router.back()
}
//跳转聊天页面
const goToChat = () => {
  router.push({
    path: '/chat',
    query: {
      scene:'detail',
      city: formData.city
    }
  })
}



</script>

<style scoped>
.page-container {
  min-height: 100vh;
  background-color: #f5f5f5;
  padding-bottom: 70px;
}

.page-header {
  position: sticky;
  top: 0;
  z-index: 100;
  background-color: #fff;
  height: 46px;
}

.page-content {
  padding: 16px;
}

.common-button {
  width: 100%;
  height: 44px;
  line-height: 44px;
  font-size: 16px;
  border-radius: 8px;
}

.primary-button {
  background-color: #1989fa !important;
  border: none !important;
}

.secondary-button {
  background-color: #fff !important;
  color: #1989fa !important;
  border: 1px solid #1989fa !important;
}

.card {
  background-color: #fff;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.section-title {
  font-size: 18px;
  font-weight: 600;
  color: #323233;
  margin-bottom: 12px;
}

.streaming-cursor {
  display: inline-block;
  animation: blink 1s infinite;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

.loading-container {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 40px 0;
}
</style>
