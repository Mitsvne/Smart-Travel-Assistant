<template>
  <div class="profile-container">
    <van-nav-bar 
      title="我的" 
    />
    
    <!-- 用户信息区域 -->
    <div class="user-info">
      <van-image 
        :src="userAvatar" 
        round 
        class="avatar"
      />
      <div class="user-details">
        <h2 class="user-name">{{ userName }}</h2>
        <p class="user-desc">欢迎使用智能旅游助手</p>
      </div>
    </div>
    
    <!-- 功能菜单 -->
    <div class="menu-section">
      <h3 class="menu-title">我的服务</h3>
      <van-cell-group>
        <van-cell 
          title="我的收藏" 
          is-link 
          :icon="'star-o'"
          @click="showToast('功能开发中')"
        />
        <van-cell 
          title="历史记录" 
          is-link 
          :icon="'history'"
          @click="goHistory"
        />
        <van-cell 
          title="设置" 
          is-link 
          :icon="'settings'"
          @click="showToast('功能开发中')"
        />
      </van-cell-group>
    </div>
    
    <!-- 关于我们 -->
    <div class="menu-section">
      <h3 class="menu-title">关于</h3>
      <van-cell-group>
        <van-cell 
          title="关于我们" 
          is-link 
          @click="showAboutDialog"
        />
        <van-cell 
          title="版本信息" 
          value="v1.0.0"
        />
      </van-cell-group>
    </div>
    
    <!-- 关于我们对话框 -->
    <van-dialog 
      v-model:show="aboutDialogVisible" 
      title="关于我们"
      show-cancel-button
    >
      <div class="about-content">
        <p>智能旅游助手 v1.0.0</p>
        <p class="mt-2">基于 AI 技术的智能旅游规划平台</p>
        <p class="mt-2">为您提供个性化的旅游行程推荐和实时旅游咨询服务</p>
        <p class="mt-4 text-center">© 2024 智能旅游助手</p>
      </div>
    </van-dialog>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'

const router = useRouter()

// 用户信息
const userAvatar = 'https://img.yzcdn.cn/vant/cat.jpeg'
const userName = '游客'

// 对话框状态
const aboutDialogVisible = ref(false)

// 进入历史记录页
const goHistory = () => {
  router.push('/history')
}

// 显示关于我们对话框
const showAboutDialog = () => {
  aboutDialogVisible.value = true
}
</script>

<style scoped>
.profile-container {
  min-height: 100vh;
  padding-bottom: 70px;
  background: #f2f4f8;
}

/* 导航栏与用户信息拼接成渐变头部 */
:deep(.van-nav-bar) {
  background: #1989fa;
}
:deep(.van-nav-bar)::after {
  display: none;
}
:deep(.van-nav-bar__title) {
  color: #fff;
}

.user-info {
  display: flex;
  align-items: center;
  padding: 24px 20px 32px;
  background: linear-gradient(135deg, #1989fa 0%, #36cbcb 100%);
  color: white;
  border-bottom-left-radius: 24px;
  border-bottom-right-radius: 24px;
}

.avatar {
  width: 80px;
  height: 80px;
  border: 3px solid rgba(255, 255, 255, 0.4);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.12);
}

.user-details {
  margin-left: 20px;
}

.user-name {
  font-size: 20px;
  font-weight: 600;
  margin-bottom: 5px;
}

.user-desc {
  font-size: 14px;
  opacity: 0.9;
}

.menu-section {
  margin: 16px;
  background-color: #fff;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 6px 20px rgba(31, 45, 61, 0.06);
}

.menu-title {
  position: relative;
  padding: 14px 16px 10px 28px;
  font-size: 15px;
  font-weight: 600;
  color: #323233;
}
.menu-title::before {
  content: '';
  position: absolute;
  left: 16px;
  top: 15px;
  bottom: 11px;
  width: 4px;
  border-radius: 2px;
  background: linear-gradient(180deg, #1989fa, #36cbcb);
}

.menu-section :deep(.van-cell) {
  align-items: center;
  padding: 14px 16px;
}
.menu-section :deep(.van-cell__title) {
  font-size: 15px;
  color: #323233;
}
.menu-section :deep(.van-cell__left-icon) {
  color: #1989fa;
  font-size: 18px;
  margin-right: 10px;
}

.about-content {
  padding: 16px;
  text-align: center;
  line-height: 1.6;
}

.mt-2 {
  margin-top: 8px;
}

.mt-4 {
  margin-top: 16px;
}

.text-center {
  text-align: center;
}
</style>