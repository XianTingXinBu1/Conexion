<script setup lang="ts">
import { Sun, Moon, MessageSquare, Zap, Settings, FileText, User, BookOpen, Hash, Keyboard } from 'lucide-vue-next';
import type { Theme } from '../types';

interface Props {
  theme: Theme;
}

defineProps<Props>();

const emit = defineEmits<{
  toggleTheme: [];
  navigateChat: [];
  navigateApiPreset: [];
  navigateSettings: [];
  navigateConversationList: [];
  navigateRegexScript: [];
  navigateRoleManagement: [];
  navigatePromptPreset: [];
  navigateKnowledgeBase: [];
}>();

const handleConversationClick = () => {
  emit('navigateConversationList');
};

const handleApiPresetClick = () => {
  emit('navigateApiPreset');
};

const handleSettingsClick = () => {
  emit('navigateSettings');
};

const handleRegexScriptClick = () => {
  emit('navigateRegexScript');
};

const handleCharacterClick = () => {
  emit('navigateRoleManagement');
};

const handlePromptPresetClick = () => {
  emit('navigatePromptPreset');
};

const handleKnowledgeBaseClick = () => {
  emit('navigateKnowledgeBase');
};
</script>

<template>
  <div class="main-page">
    <!-- 极简头部 -->
    <header class="header">
      <div class="brand">
        <span class="brand-name">Conexion</span>
        <span class="brand-dot"></span>
      </div>
      <button class="theme-toggle" @click="emit('toggleTheme')">
        <Sun v-if="theme === 'light'" :size="20" />
        <Moon v-else :size="20" />
      </button>
    </header>

    <!-- 主要内容区域 -->
    <main class="content">
      <!-- 功能入口 - 大卡片布局 -->
      <div class="features">
        <!-- 会话 - 主入口 -->
        <div class="feature-primary" @click="handleConversationClick">
          <div class="feature-icon-wrapper primary">
            <MessageSquare :size="28" />
          </div>
          <div class="feature-info">
            <span class="feature-title">开始对话</span>
            <span class="feature-desc">开启新的对话或继续之前的会话</span>
          </div>
          <div class="feature-arrow">→</div>
        </div>

        <!-- 次要功能 -->
        <div class="feature-secondary" @click="handleRegexScriptClick">
          <div class="feature-icon-wrapper secondary regex">
            <Hash :size="22" />
          </div>
          <span class="feature-label">正则脚本</span>
        </div>

        <div class="feature-secondary" @click="handleApiPresetClick">
          <div class="feature-icon-wrapper secondary api">
            <Zap :size="22" />
          </div>
          <span class="feature-label">API 预设</span>
        </div>

        <div class="feature-secondary" @click="handleCharacterClick">
          <div class="feature-icon-wrapper secondary character">
            <User :size="22" />
          </div>
          <span class="feature-label">角色卡</span>
        </div>

        <div class="feature-secondary" @click="handleKnowledgeBaseClick">
          <div class="feature-icon-wrapper secondary knowledge">
            <BookOpen :size="22" />
          </div>
          <span class="feature-label">知识库</span>
        </div>

        <div class="feature-secondary" @click="handlePromptPresetClick">
          <div class="feature-icon-wrapper secondary prompt">
            <FileText :size="22" />
          </div>
          <span class="feature-label">提示词预设</span>
        </div>

        <!-- 宏 - 暂不可用 -->
        <div class="feature-secondary disabled">
          <div class="feature-icon-wrapper secondary about">
            <Keyboard :size="22" />
          </div>
          <span class="feature-label">宏系统</span>
          <span class="feature-badge">即将推出</span>
        </div>

        <!-- 设置 -->
        <div class="feature-secondary" @click="handleSettingsClick">
          <div class="feature-icon-wrapper secondary settings">
            <Settings :size="22" />
          </div>
          <span class="feature-label">设置</span>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.main-page {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--vintage-bg);
  overflow: hidden;
}

/* ==================== 头部 ==================== */
.header {
  padding: 24px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}

.brand {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.brand-name {
  font-size: 22px;
  font-weight: 300;
  letter-spacing: -0.5px;
  color: var(--vintage-text);
}

.brand-dot {
  width: 6px;
  height: 6px;
  background: #9D8DF1;
  border-radius: 50%;
  animation: pulse 2s ease-in-out infinite;
}

[data-theme='dark'] .brand-dot {
  background: #B7A3E3;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(0.8); }
}

.theme-toggle {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  background: var(--vintage-card-bg);
  color: var(--vintage-text);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.theme-toggle:active {
  transform: scale(0.95);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
}

/* ==================== 主要内容 ==================== */
.content {
  flex: 1;
  overflow-y: auto;
  padding: 24px 20px 40px;
}

/* 功能区域 */
.features {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* 主入口卡片 */
.feature-primary {
  background: #7B6B93;
  border-radius: 20px;
  padding: 24px;
  display: flex;
  align-items: center;
  gap: 16px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  box-shadow: 0 4px 16px rgba(123, 107, 147, 0.3);
  position: relative;
  overflow: hidden;
}

/* 深色主题 */
[data-theme='dark'] .feature-primary {
  background: #9D8DF1;
}

.feature-primary:active {
  transform: scale(0.98);
  box-shadow: 0 2px 8px rgba(123, 107, 147, 0.4);
}

.feature-icon-wrapper {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 14px;
}

.feature-icon-wrapper.primary {
  width: 56px;
  height: 56px;
  background: rgba(255, 255, 255, 0.25);
  color: white;
}

.feature-icon-wrapper.secondary {
  width: 44px;
  height: 44px;
  color: white;
}

.feature-icon-wrapper.secondary.regex {
  background: linear-gradient(135deg, #8B7BA0, #A08FB0);
}

.feature-icon-wrapper.secondary.api {
  background: linear-gradient(135deg, #6B7BA0, #7D92B5);
}

.feature-icon-wrapper.secondary.character {
  background: linear-gradient(135deg, #7B6BA0, #8F80B5);
}

.feature-icon-wrapper.secondary.knowledge {
  background: linear-gradient(135deg, #8E7BA0, #A090B0);
}

.feature-icon-wrapper.secondary.prompt {
  background: linear-gradient(135deg, #6B8BA0, #7FA5B5);
}

.feature-icon-wrapper.secondary.settings {
  background: linear-gradient(135deg, #5B5B6B, #6B6B7A);
}

.feature-icon-wrapper.secondary.about {
  background: linear-gradient(135deg, #7B7B8B, #8B8B9B);
}

.feature-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.feature-title {
  font-size: 18px;
  font-weight: 600;
  color: white;
  letter-spacing: -0.3px;
}

.feature-desc {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.8);
  font-weight: 400;
  line-height: 1.4;
}

.feature-arrow {
  font-size: 24px;
  color: white;
  font-weight: 300;
  opacity: 0.7;
  transition: all 0.3s ease;
}

.feature-primary:active .feature-arrow {
  transform: translateX(4px);
}

/* 次要功能 */
.feature-secondary {
  background: var(--vintage-card-bg);
  border-radius: 16px;
  padding: 16px 20px;
  display: flex;
  align-items: center;
  gap: 14px;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  border: 1px solid var(--vintage-border);
  position: relative;
}

.feature-secondary:active {
  transform: scale(0.97);
  background: var(--vintage-card-hover);
}

.feature-secondary.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.feature-secondary.disabled:active {
  transform: none;
}

.feature-label {
  flex: 1;
  font-size: 15px;
  font-weight: 500;
  color: var(--vintage-text);
  letter-spacing: -0.2px;
}

.feature-badge {
  font-size: 11px;
  color: var(--vintage-accent);
  background: var(--vintage-badge-bg);
  padding: 4px 10px;
  border-radius: 12px;
  font-weight: 600;
  letter-spacing: 0.2px;
}

/* ==================== 滚动条样式 ==================== */
.content::-webkit-scrollbar {
  width: 4px;
}

.content::-webkit-scrollbar-track {
  background: transparent;
}

.content::-webkit-scrollbar-thumb {
  background: #9D8DF1;
  border-radius: 4px;
  opacity: 0.3;
}

[data-theme='dark'] .content::-webkit-scrollbar-thumb {
  background: #B7A3E3;
}

/* ==================== 复古配色变量 ==================== */
[data-theme='light'] {
  --vintage-bg: #F8F7FF;
  --vintage-card-bg: #FFFFFF;
  --vintage-card-hover: #F2F0FA;
  --vintage-accent: #9D8DF1;
  --vintage-text: #2D2D44;
  --vintage-text-secondary: #6B6B7A;
  --vintage-border: rgba(157, 141, 241, 0.15);
  --vintage-badge-bg: rgba(157, 141, 241, 0.12);
}

[data-theme='dark'] {
  --vintage-bg: #121218;
  --vintage-card-bg: #1A1A22;
  --vintage-card-hover: #22222E;
  --vintage-accent: #B7A3E3;
  --vintage-text: #E6E6FA;
  --vintage-text-secondary: #A0A0B8;
  --vintage-border: rgba(183, 163, 227, 0.18);
  --vintage-badge-bg: rgba(183, 163, 227, 0.15);
}
</style>