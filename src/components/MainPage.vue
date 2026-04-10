<script setup lang="ts">
import { Sun, Moon, MessageSquare, Zap, Settings, FileText, User, BookOpen, Hash } from 'lucide-vue-next';
import { useRouter } from 'vue-router';
import { inject, onMounted } from 'vue';
import { prefetchRouteComponents } from '@/router';
import type { Theme } from '../types';

// 获取路由实例
const router = useRouter();

// 从 AppProvider 注入的主题切换函数
const appTheme = inject('app-theme') as { theme: Theme; toggleTheme: () => void } | undefined;

// 获取主题
const theme = appTheme?.theme || 'light';

const likelyNextRoutes = [
  '/conversation-list',
  '/role-management',
  '/knowledge-base',
  '/api-preset',
] as const;

const triggerLikelyRoutePrefetch = () => {
  void prefetchRouteComponents([...likelyNextRoutes]);
};

onMounted(() => {
  if (typeof window === 'undefined') {
    return;
  }

  const browserWindow = window as Window & {
    requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
  };

  const runSoon = () => {
    window.setTimeout(() => triggerLikelyRoutePrefetch(), 900);
  };

  if (typeof browserWindow.requestIdleCallback === 'function') {
    browserWindow.requestIdleCallback(() => triggerLikelyRoutePrefetch(), { timeout: 1800 });
  } else {
    runSoon();
  }
});

/**
 * 切换主题
 */
const handleToggleTheme = () => {
  appTheme?.toggleTheme();
};

/**
 * 导航到会话列表
 */
const navigateToConversationList = () => {
  router.push('/conversation-list');
};

/**
 * 导航到 API 预设
 */
const navigateToApiPreset = () => {
  router.push('/api-preset');
};

/**
 * 导航到设置
 */
const navigateToSettings = () => {
  router.push('/settings');
};

/**
 * 导航到正则脚本
 */
const navigateToRegexScript = () => {
  router.push('/regex-script');
};

/**
 * 导航到角色管理
 */
const navigateToRoleManagement = () => {
  router.push('/role-management');
};

/**
 * 导航到提示词预设
 */
const navigateToPromptPreset = () => {
  router.push('/prompt-preset');
};

/**
 * 导航到知识库
 */
const navigateToKnowledgeBase = () => {
  router.push('/knowledge-base');
};
</script>

<template>
  <div class="main-page">
    <!-- 头部 -->
    <header class="header">
      <div class="brand">
        <span class="brand-name">Conexion</span>
        <span class="brand-dot"></span>
      </div>
      <button class="theme-toggle" @click="handleToggleTheme">
        <Sun v-if="theme === 'light'" :size="20" />
        <Moon v-else :size="20" />
      </button>
    </header>

    <!-- 主要内容 -->
    <main class="content">
      <!-- 主入口 -->
      <div class="hero-section">
        <div class="hero-card" @click="navigateToConversationList" @pointerenter="triggerLikelyRoutePrefetch" @touchstart.passive="triggerLikelyRoutePrefetch">
          <div class="hero-icon">
            <MessageSquare :size="32" />
          </div>
          <div class="hero-text">
            <h2 class="hero-title">开始对话</h2>
            <p class="hero-subtitle">创建新的会话或继续之前的对话</p>
          </div>
          <div class="hero-arrow">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </div>
        </div>
      </div>

      <!-- 内容管理 -->
      <section class="section">
        <h3 class="section-title">内容管理</h3>
        <div class="grid">
          <div class="grid-card" @click="navigateToRoleManagement" @pointerenter="triggerLikelyRoutePrefetch">
            <div class="grid-icon role">
              <User :size="24" />
            </div>
            <span class="grid-label">角色卡</span>
          </div>
          <div class="grid-card" @click="navigateToKnowledgeBase" @pointerenter="triggerLikelyRoutePrefetch">
            <div class="grid-icon knowledge">
              <BookOpen :size="24" />
            </div>
            <span class="grid-label">知识库</span>
          </div>
          <div class="grid-card" @click="navigateToPromptPreset">
            <div class="grid-icon prompt">
              <FileText :size="24" />
            </div>
            <span class="grid-label">提示词</span>
          </div>
          <div class="grid-card" @click="navigateToRegexScript">
            <div class="grid-icon regex">
              <Hash :size="24" />
            </div>
            <span class="grid-label">正则脚本</span>
          </div>
        </div>
      </section>

      <!-- 配置与设置 -->
      <section class="section">
        <h3 class="section-title">配置</h3>
        <div class="list">
          <div class="list-card" @click="navigateToApiPreset" @pointerenter="triggerLikelyRoutePrefetch">
            <div class="list-icon api">
              <Zap :size="20" />
            </div>
            <div class="list-text">
              <span class="list-label">API 预设</span>
              <span class="list-desc">配置 API 密钥和模型参数</span>
            </div>
            <svg class="list-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </div>
          <div class="list-card" @click="navigateToSettings">
            <div class="list-icon settings">
              <Settings :size="20" />
            </div>
            <div class="list-text">
              <span class="list-label">设置</span>
              <span class="list-desc">主题、显示和数据管理</span>
            </div>
            <svg class="list-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

<style scoped>
.main-page {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
  overflow: hidden;
}

/* ==================== 头部 ==================== */
.header {
  padding: 20px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.brand-name {
  font-size: 18px;
  font-weight: 700;
  color: var(--accent-purple);
  letter-spacing: -0.3px;
}

.brand-dot {
  width: 6px;
  height: 6px;
  background: var(--accent-purple);
  border-radius: 50%;
  animation: pulse 2.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(0.9); }
}

.theme-toggle {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.theme-toggle:active {
  transform: scale(0.9);
  background: var(--accent-soft);
}

/* ==================== 主要内容 ==================== */
.content {
  flex: 1;
  overflow-y: auto;
  padding: 24px 20px 40px;
}

/* ==================== 主入口 ==================== */
.hero-section {
  margin-bottom: 32px;
}

.hero-card {
  background: linear-gradient(135deg, var(--accent-gradient-start), var(--accent-gradient-end));
  border-radius: 24px;
  padding: 28px 24px;
  display: flex;
  align-items: center;
  gap: 20px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  box-shadow: 0 8px 32px var(--shadow-color);
}

.hero-card:active {
  transform: scale(0.98);
  box-shadow: 0 4px 16px var(--shadow-color);
}

.hero-icon {
  width: 64px;
  height: 64px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-on-accent, #FFFFFF);
  flex-shrink: 0;
}

.hero-text {
  flex: 1;
  min-width: 0;
}

.hero-title {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-on-accent, #FFFFFF);
  margin: 0 0 6px 0;
  letter-spacing: -0.3px;
}

.hero-subtitle {
  font-size: 14px;
  color: var(--text-on-accent-muted, rgba(255, 255, 255, 0.85));
  margin: 0;
  font-weight: 400;
  line-height: 1.4;
}

.hero-arrow {
  color: var(--text-on-accent, #FFFFFF);
  opacity: 0.7;
  transition: all 0.3s ease;
  flex-shrink: 0;
}

.hero-card:active .hero-arrow {
  transform: translateX(3px);
}

/* ==================== 分区 ==================== */
.section {
  margin-bottom: 28px;
}

.section:last-child {
  margin-bottom: 0;
}

.section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-muted);
  margin: 0 0 14px 0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* ==================== 网格 ==================== */
.grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.grid-card {
  background: var(--card);
  border-radius: 16px;
  padding: 20px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  border: 1px solid var(--border);
}

.grid-card:active {
  transform: scale(0.96);
  background: var(--card-hover);
}

.grid-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
}

.grid-icon.role {
  background: linear-gradient(135deg, #A085E8, #8B6BC7);
}

.grid-icon.knowledge {
  background: linear-gradient(135deg, #7D8FE8, #6376C7);
}

.grid-icon.prompt {
  background: linear-gradient(135deg, #7DA8E8, #6391C7);
}

.grid-icon.regex {
  background: linear-gradient(135deg, #A8857D, #926B68);
}

.grid-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-main);
  letter-spacing: -0.2px;
}

/* ==================== 列表 ==================== */
.list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.list-card {
  background: var(--card);
  border-radius: 14px;
  padding: 16px 18px;
  display: flex;
  align-items: center;
  gap: 14px;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  border: 1px solid var(--border);
}

.list-card:active {
  transform: scale(0.98);
  background: var(--card-hover);
}

.list-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  flex-shrink: 0;
}

.list-icon.api {
  background: linear-gradient(135deg, #E8A87D, #C79163);
}

.list-icon.settings {
  background: linear-gradient(135deg, #8D8D9D, #727282);
}

.list-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.list-label {
  font-size: 15px;
  font-weight: 500;
  color: var(--text-main);
  letter-spacing: -0.2px;
}

.list-desc {
  font-size: 12px;
  color: var(--text-muted);
  font-weight: 400;
}

.list-arrow {
  color: var(--text-muted);
  flex-shrink: 0;
  opacity: 0.5;
}

/* ==================== 滚动条 ==================== */
.content::-webkit-scrollbar {
  width: 3px;
}

.content::-webkit-scrollbar-track {
  background: transparent;
}

.content::-webkit-scrollbar-thumb {
  background: var(--accent-purple);
  border-radius: 3px;
  opacity: 0.25;
}
</style>
