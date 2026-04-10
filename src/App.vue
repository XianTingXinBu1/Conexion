<script setup lang="ts">
import AppProvider from './components/AppProvider.vue';
import { NotificationContainer } from '@/modules/notification';
</script>

<template>
  <AppProvider>
    <div class="app">
      <router-view v-slot="{ Component, route }">
        <Transition :name="(route.meta.transitionName as string) || 'fade'" mode="out-in">
          <component :is="Component" :key="route.path" />
        </Transition>
      </router-view>

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
  --border: var(--border-color);
  --card: var(--bg-secondary);
  --card-hover: #F1EEFF;
  --shadow: 0 8px 30px rgba(157, 141, 241, 0.08);
  --shadow-color: rgba(157, 141, 241, 0.18);
  --accent-gradient-start: #9D8DF1;
  --accent-gradient-end: #7D8FE8;
  --text-on-accent: #FFFFFF;
  --text-on-accent-muted: rgba(255, 255, 255, 0.88);
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
  --border: var(--border-color);
  --card: var(--bg-secondary);
  --card-hover: #262633;
  --shadow: 0 8px 40px rgba(0, 0, 0, 0.3);
  --shadow-color: rgba(0, 0, 0, 0.28);
  --accent-gradient-start: #B7A3E3;
  --accent-gradient-end: #7D8FE8;
  --text-on-accent: #FFFFFF;
  --text-on-accent-muted: rgba(255, 255, 255, 0.85);
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