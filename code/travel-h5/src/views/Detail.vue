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
  background-color: #f2f4f8;
  padding-bottom: 80px;
}

.page-header {
  position: sticky;
  top: 0;
  z-index: 100;
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

.card {
  background-color: #fff;
  border-radius: 16px;
  padding: 16px;
  margin-bottom: 16px;
  box-shadow: 0 6px 20px rgba(31, 45, 61, 0.06);
}

/* 行程概览卡片：渐变风格 */
.overview_card {
  background: linear-gradient(135deg, #1989fa 0%, #36cbcb 100%);
  color: #fff;
  box-shadow: 0 8px 20px rgba(25, 137, 250, 0.28);
}
.overview_card .trip-header h2 {
  margin: 0 0 8px;
  font-size: 22px;
  font-weight: 700;
  color: #fff;
}
.overview_card .trip-budget {
  display: inline-block;
  padding: 4px 12px;
  background: rgba(255, 255, 255, 0.22);
  border-radius: 14px;
  font-size: 14px;
}

.section-title {
  position: relative;
  padding-left: 12px;
  font-size: 17px;
  font-weight: 600;
  color: #323233;
  margin-bottom: 14px;
}
.section-title::before {
  content: '';
  position: absolute;
  left: 0;
  top: 2px;
  bottom: 2px;
  width: 4px;
  border-radius: 2px;
  background: linear-gradient(180deg, #1989fa, #36cbcb);
}

/* 行程折叠面板 */
:deep(.van-collapse) {
  border-radius: 16px;
  overflow: hidden;
  margin-bottom: 16px;
  box-shadow: 0 6px 20px rgba(31, 45, 61, 0.06);
}
:deep(.van-collapse-item__title) {
  font-size: 16px;
  font-weight: 600;
  color: #323233;
}

.schedule-section {
  margin-bottom: 16px;
}
.schedule-section:last-child {
  margin-bottom: 0;
}

.section-label {
  display: inline-block;
  padding: 2px 12px;
  margin-bottom: 8px;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 600;
  color: #fff;
}
.section-label.morning {
  background: linear-gradient(135deg, #ff9a3c, #ffb84d);
}
.section-label.afternoon {
  background: linear-gradient(135deg, #1989fa, #52a8ff);
}
.section-label.evening {
  background: linear-gradient(135deg, #7c5cff, #9d7bff);
}

/* 提示与注意事项列表 */
ul.tips-list,
ul.warnings-list {
  margin: 0;
  padding: 0;
  list-style: none;
}
.tips-list li,
.warnings-list li {
  position: relative;
  padding: 8px 0 8px 24px;
  font-size: 14px;
  color: #646566;
  line-height: 1.6;
  border-bottom: 1px solid #f2f4f8;
}
.tips-list li:last-child,
.warnings-list li:last-child {
  border-bottom: none;
}
.tips-list li::before {
  content: '';
  position: absolute;
  left: 5px;
  top: 15px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #1989fa;
}
.warnings-list li::before {
  content: '!';
  position: absolute;
  left: 0;
  top: 9px;
  width: 16px;
  height: 16px;
  line-height: 16px;
  text-align: center;
  border-radius: 50%;
  background: #ff976a;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
}

/* 底部操作栏 */
.detail-footer {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 10px 16px;
  background: #fff;
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.05);
  max-width: 750px;
  margin: 0 auto;
}

.primary-button {
  border: none !important;
  background: linear-gradient(135deg, #1989fa 0%, #36cbcb 100%) !important;
  box-shadow: 0 8px 18px rgba(25, 137, 250, 0.32);
}

.loading-container {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 40px 0;
}
</style>
