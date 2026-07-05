<template>
	<div class="page-container home-page">
		<div class="hero">
			<div class="hero-inner">
				<div class="hero-badge">
					<van-icon name="star" />AI 智能规划
				</div>
				<h1 class="hero-title">智能旅游助手</h1>
				<p class="hero-subtitle">基于 AI 的智能景点介绍与行程规划系统</p>
			</div>
		</div>
		<div class="page-content">
			<div class="card search-card">
				<div class="section-title">
					<van-icon name="guide-o" class="title-icon" />规划你的旅程
				</div>
				<van-field
					class="form-field"
					@click="showCityPicker = true"
					is-link
					readonly
					v-model="formData.city"
					label="目的地"
					placeholder="请选择城市"
				/>
				<van-field
					class="form-field"
					v-model="formData.budget"
					label="预算"
					placeholder="请输入预算"
					type="number"
					:min="0"
					:max="1000000"
					:step="100"
				/>
				<van-field
					class="form-field"
					v-model="formData.days"
					label="天数"
					placeholder="请输入天数"
					type="number"
					:min="1"
					:max="30"
					:step="1"
				/>
				<van-button
					class="submit-btn"
					size="large"
					round
					:loading="isLoading"
					@click="handleSubmit"
				>开始规划</van-button>
			</div>

			<div class="card quick-actions">
				<div class="section-title">
					<van-icon name="apps-o" class="title-icon" />快捷入口
				</div>
				<div class="quick-grid">
					<div class="quick-item" @click="goPage('/chat')">
						<div class="quick-icon icon-chat"><van-icon name="chat-o" /></div>
						<span class="quick-text">AI对话</span>
					</div>
					<div class="quick-item" @click="goPage('/profile')">
						<div class="quick-icon icon-user"><van-icon name="user-o" /></div>
						<span class="quick-text">我的</span>
					</div>
				</div>
			</div>

			<div class="card popular-destinations">
				<div class="section-title">
					<van-icon name="fire-o" class="title-icon" />热门目的地
				</div>
				<div class="city-list">
					<div
						class="city-tag"
						:class="{ 'city-tag-active': formData.city === city }"
						v-for="(city, index) in popularCities"
						:key="index"
						@click="selectedCity(city)"
					>
						<van-icon name="location-o" />{{ city }}
					</div>
				</div>
			</div>

			<van-popup round v-model:show="showCityPicker" position="bottom">
				<van-picker
					title="选择城市"
					:columns="cityColumns"
					@confirm="handleCityConfirm"
					@cancel="showCityPicker=false"
				/>
			</van-popup>
		</div>
	</div>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
// 路由实例
const router = useRouter()
// 旅游规划表单数据
const formData = reactive({
    city: '',
    budget: null,
    days: null
})
// 城市选择器显示状态
const showCityPicker = ref(false)
// 城市选择器数据
const allCities = [
'北京', '上海', '广州', '深圳', '成都', '杭州', '西安', '重庆',
'南京', '武汉', '苏州', '长沙', '天津', '郑州', '济南', '青岛',
'大连', '沈阳', '哈尔滨', '长春', '福州', '厦门', '南昌', '合肥',
'昆明', '贵阳', '南宁', '桂林', '海口', '三亚', '丽江', '大理',
'西安', '兰州', '乌鲁木齐', '拉萨', '呼和浩特', '太原', '石家庄'
]
const popularCities = ['北京', '上海', '广州', '深圳', '成都', '杭州', '西安', '重庆']
const cityColumns = allCities.map(city => ({
    text: city,
    value: city
}))

const handleCityConfirm = ({ selectedValues }) => {
    formData.city = selectedValues[0]
    showCityPicker.value = false
}
// 加载状态
const isLoading = ref(false)
// 提交表单
const handleSubmit = async () => {
    // 判定目的地是否填写
    if (!formData.city) {
        showToast('请选择目的地')
        return
    }
    // 判定预算是否填写,预算必须大于100元
    if (!formData.budget || formData.budget < 100) {
        showToast('预算必须大于100元')
        return
    }
    // 判定天数是否填写，天数需要在1-30天之间
    if (!formData.days || formData.days < 1 || formData.days > 30) {
        showToast('天数必须在1-30天之间')
        return
    }
    isLoading.value = true
    router.push({
            path: '/detail',
            query: {
                city: formData.city,
                budget: formData.budget,
                days: formData.days
            }
        })
}


// 跳转页面
const goPage = (path) => {
    router.push(path)
}
// 选择城市
const selectedCity = (city) => {
    formData.city = city
    showCityPicker.value = false
}
</script>

<style scoped>
.home-page {
	min-height: 100vh;
	padding-bottom: 70px;
	background: #f2f4f8;
}

/* 顶部渐变横幅 */
.hero {
	position: relative;
	padding: 40px 20px 60px;
	background: linear-gradient(135deg, #1989fa 0%, #23b6c8 55%, #36cbcb 100%);
	border-bottom-left-radius: 28px;
	border-bottom-right-radius: 28px;
	color: #fff;
	overflow: hidden;
}
.hero::after {
	content: '';
	position: absolute;
	top: -50px;
	right: -40px;
	width: 170px;
	height: 170px;
	background: rgba(255, 255, 255, 0.12);
	border-radius: 50%;
}
.hero-inner {
	position: relative;
	z-index: 1;
}
.hero-badge {
	display: inline-flex;
	align-items: center;
	gap: 4px;
	padding: 4px 12px;
	margin-bottom: 12px;
	background: rgba(255, 255, 255, 0.2);
	border-radius: 14px;
	font-size: 12px;
}
.hero-title {
	margin: 0 0 6px;
	font-size: 26px;
	font-weight: 700;
	letter-spacing: 1px;
}
.hero-subtitle {
	margin: 0;
	font-size: 13px;
	opacity: 0.9;
}

/* 内容上移覆盖横幅 */
.page-content {
	position: relative;
	margin-top: -36px;
	padding: 16px;
}

.card {
	padding: 16px;
	background: #fff;
	border-radius: 16px;
	box-shadow: 0 6px 20px rgba(31, 45, 61, 0.06);
	margin-bottom: 16px;
}
.section-title {
	display: flex;
	align-items: center;
	gap: 6px;
	margin-bottom: 14px;
	font-size: 17px;
	font-weight: 600;
	color: #323233;
}
.title-icon {
	color: #1989fa;
	font-size: 18px;
}

/* 表单项 */
.form-field {
	margin-bottom: 12px;
	background: #f7f8fa;
	border-radius: 10px;
	overflow: hidden;
}
.form-field :deep(.van-field__label) {
	color: #323233;
	font-weight: 500;
}

/* 开始规划按钮 */
.submit-btn {
	width: 100%;
	height: 48px;
	margin-top: 4px;
	border: none !important;
	font-size: 16px;
	font-weight: 600;
	color: #fff !important;
	background: linear-gradient(135deg, #1989fa 0%, #36cbcb 100%) !important;
	box-shadow: 0 8px 18px rgba(25, 137, 250, 0.32);
}

/* 快捷入口 */
.quick-grid {
	display: flex;
	gap: 12px;
}
.quick-item {
	flex: 1;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 8px;
	padding: 16px 0;
	background: #f7f8fa;
	border-radius: 12px;
	cursor: pointer;
	transition: transform 0.2s;
}
.quick-item:active {
	transform: translateY(2px);
}
.quick-icon {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 44px;
	height: 44px;
	border-radius: 50%;
	font-size: 22px;
	color: #fff;
}
.icon-chat {
	background: linear-gradient(135deg, #1989fa, #52a8ff);
}
.icon-user {
	background: linear-gradient(135deg, #ff9a3c, #ff6b6b);
}
.quick-text {
	font-size: 14px;
	font-weight: 500;
	color: #323233;
}

/* 热门目的地 */
.city-list {
	display: flex;
	flex-wrap: wrap;
	gap: 10px;
}
.city-tag {
	display: flex;
	align-items: center;
	gap: 3px;
	padding: 8px 14px;
	background: #f2f4f8;
	color: #646566;
	border-radius: 20px;
	font-size: 14px;
	cursor: pointer;
	transition: all 0.25s;
}
.city-tag .van-icon {
	font-size: 13px;
}
.city-tag-active {
	color: #fff;
	background: linear-gradient(135deg, #1989fa 0%, #36cbcb 100%);
	box-shadow: 0 4px 10px rgba(25, 137, 250, 0.3);
}
</style>
