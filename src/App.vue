<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import AppProvider from './components/AppProvider.vue';
import ConfirmDialog from './components/ConfirmDialog.vue';
import { NotificationContainer } from '@/modules/notification';

const router = useRouter();

// 本地管理退出确认状态（使用 Vue Router 守卫）
const showExitConfirm = ref(false);

/**
 * 处理路由变化
 */
const handleRouteChange = () => {
  // 如果当前不在首页，监听浏览器返回事件
  if (router.currentRoute.value.path !== '/') {
    // 添加浏览器历史记录
    window.history.pushState({ canExit: false }, '', '');
  }
};

/**
 * 处理浏览器返回事件
 */
const handlePopState = (event: PopStateEvent) => {
  // 如果有 canExit 状态，说明用户想要退出
  if (event.state && event.state.canExit === false) {
    event.preventDefault();
    showExitConfirm.value = true;
  }
};

/**
 * 确认退出
 */
const confirmExit = () => {
  showExitConfirm.value = false;
  // 移除事件监听
  window.removeEventListener('popstate', handlePopState);
  // 执行返回
  window.history.back();
};

/**
 * 取消退出
 */
const cancelExit = () => {
  showExitConfirm.value = false;
  // 重新添加历史记录
  window.history.pushState({ canExit: false }, '', '');
};

// 监听路由变化
router.afterEach(handleRouteChange);

// 生命周期
onMounted(() => {
  window.addEventListener('popstate', handlePopState);
  // 初始化历史记录
  if (router.currentRoute.value.path !== '/') {
    window.history.pushState({ canExit: false }, '', '');
  }
});

onUnmounted(() => {
  window.removeEventListener('popstate', handlePopState);
});
</script>

<template>
  <AppProvider>
    <div class="app">
      <router-view v-slot="{ Component, route }">
        <Transition :name="(route.meta.transitionName as string) || 'fade'" mode="out-in">
          <component :is="Component" :key="route.path" />
        </Transition>
      </router-view>

      <!-- 退出确认对话框 -->
      <ConfirmDialog
        :show="showExitConfirm"
        title="退出应用"
        message="确定要退出应用吗？"
        type="warning"
        confirm-text="退出"
        cancel-text="取消"
        @confirm="confirmExit"
        @cancel="cancelExit"
      />

      <!-- 通知容器 -->
      <NotificationContainer />
    </div>
  </AppProvider>
</template>

<style>
:root {
  --bg-primary: #F8F7FF;
  --bg-secondary: #FFFFFF;
  --accent-purple: #9D8DF1;
  --accent-soft: #E0DAFF;
  --text-main: #2D2D44;
  --text-muted: #8E8E93;
  --border-color: rgba(157, 141, 241, 0.1);
  --shadow: 0 8px 30px rgba(157, 141, 241, 0.08);
  --transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

[data-theme='dark'] {
  --bg-primary: #12121A;
  --bg-secondary: #1C1C26;
  --accent-purple: #B7A3E3;
  --accent-soft: #2D2D44;
  --text-main: #E6E6FA;
  --text-muted: #A0A0B8;
  --border-color: rgba(183, 163, 227, 0.1);
  --shadow: 0 8px 40px rgba(0, 0, 0, 0.3);
}

* {
  box-sizing: border-box;
  -webkit-tap-highlight-color: transparent;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
}

body {
  margin: 0;
  padding: 0;
  background-color: var(--bg-primary);
  color: var(--text-main);
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  transition: background-color var(--transition);
}

#app {
  width: 100%;
  height: 100%;
  display: flex;
  overflow: hidden;
}

.app {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
}

/* 页面过渡动画 - 淡入淡出效果 */
.slide-forward-enter-active,
.slide-forward-leave-active,
.slide-back-enter-active,
.slide-back-leave-active {
  transition: opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1);
}

.slide-forward-enter-from,
.slide-back-enter-from {
  opacity: 0;
}

.slide-forward-leave-to,
.slide-back-leave-to {
  opacity: 0;
}
</style>