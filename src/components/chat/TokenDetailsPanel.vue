<script setup lang="ts">
import { ref, watch } from 'vue';
import type { Theme, Preset } from '../../types';

interface BuildMetadata {
  filledPlaceholders?: Record<string, { contentLength: number }>;
  totalItems: number;
  enabledItems: number;
}

interface SystemPromptResult {
  estimatedTokens: number;
  metadata?: BuildMetadata;
}

interface UsageStats {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

interface Props {
  currentContextCount: number;
  maxContextLength: number;
  userTokens: number;
  aiTokens: number;
  chatMessageCount: number;
  userMessageCount: number;
  aiMessageCount: number;
  lastSystemPromptResult: SystemPromptResult | null;
  currentApiPreset: Preset | null;
  usage: UsageStats | null;
  theme: Theme;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  close: [];
}>();

// 展开/折叠状态
const expandedSections = ref({
  chatHistory: false,
  promptDetails: false,
});

// 切换展开状态
const toggleSection = (section: 'chatHistory' | 'promptDetails') => {
  expandedSections.value[section] = !expandedSections.value[section];
};

// 剩余可用 Token
const remainingTokens = ref(
  Math.max(0, props.maxContextLength - props.currentContextCount)
);

// 监听 props 变化，更新剩余 Token
watch(() => [props.currentContextCount, props.maxContextLength], ([current, max]) => {
  if (current !== undefined && max !== undefined) {
    remainingTokens.value = Math.max(0, max - current);
  }
});
</script>

<template>
  <Transition name="slide-in">
    <div class="token-details-panel" :class="theme">
      <div class="token-details-overlay" @click="emit('close')"></div>
      <div class="token-details-content">
        <!-- 顶部关键指标 -->
        <div class="token-summary">
          <div class="summary-item summary-main">
            <div class="summary-main-left">
              <div class="summary-label">使用率</div>
              <div class="progress-bar">
                <div class="progress-fill" :style="{ width: `${Math.round((currentContextCount / maxContextLength) * 100)}%` }"></div>
              </div>
            </div>
            <div class="summary-value token-details-percent">{{ Math.round((currentContextCount / maxContextLength) * 100) }}%</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">总使用</div>
            <div class="summary-value">{{ currentContextCount.toLocaleString() }}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">剩余</div>
            <div class="summary-value">{{ remainingTokens.toLocaleString() }}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">上限</div>
            <div class="summary-value">{{ maxContextLength.toLocaleString() }}</div>
          </div>
        </div>

        <!-- 聊天历史 -->
        <div class="token-card" @click="toggleSection('chatHistory')">
          <div class="card-header expandable">
            <span class="card-title">聊天历史</span>
            <div class="card-right">
              <span class="card-badge">{{ chatMessageCount }} 条</span>
              <svg :class="['expand-icon', { expanded: expandedSections.chatHistory }]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </div>
          </div>
          <Transition name="expand">
            <div v-if="expandedSections.chatHistory" class="card-content">
              <div class="stat-row">
                <span class="stat-label">用户</span>
                <span class="stat-value">{{ userMessageCount }} / {{ userTokens.toLocaleString() }}</span>
              </div>
              <div class="stat-row">
                <span class="stat-label">AI</span>
                <span class="stat-value">{{ aiMessageCount }} / {{ aiTokens.toLocaleString() }}</span>
              </div>
            </div>
          </Transition>
        </div>

        <!-- 系统提示词 -->
        <div class="token-card" v-if="lastSystemPromptResult" @click="toggleSection('promptDetails')">
          <div class="card-header expandable">
            <span class="card-title">系统提示词</span>
            <div class="card-right">
              <span class="card-badge">{{ lastSystemPromptResult.estimatedTokens.toLocaleString() }}</span>
              <svg :class="['expand-icon', { expanded: expandedSections.promptDetails }]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </div>
          </div>
          <Transition name="expand">
            <div v-if="expandedSections.promptDetails && lastSystemPromptResult.metadata" class="card-content">
              <div class="stat-row" v-if="lastSystemPromptResult.metadata.filledPlaceholders?.character">
                <span class="stat-label">角色</span>
                <span class="stat-value">{{ lastSystemPromptResult.metadata.filledPlaceholders.character.contentLength.toLocaleString() }}</span>
              </div>
              <div class="stat-row" v-if="lastSystemPromptResult.metadata.filledPlaceholders?.user">
                <span class="stat-label">用户</span>
                <span class="stat-value">{{ lastSystemPromptResult.metadata.filledPlaceholders.user.contentLength.toLocaleString() }}</span>
              </div>
              <div class="stat-row" v-if="lastSystemPromptResult.metadata.filledPlaceholders?.knowledge">
                <span class="stat-label">知识库</span>
                <span class="stat-value">{{ lastSystemPromptResult.metadata.filledPlaceholders.knowledge.contentLength.toLocaleString() }}</span>
              </div>
              <div class="stat-row">
                <span class="stat-label">启用</span>
                <span class="stat-value">{{ lastSystemPromptResult.metadata.enabledItems }}/{{ lastSystemPromptResult.metadata.totalItems }}</span>
              </div>
            </div>
          </Transition>
        </div>

        <!-- 模型信息 -->
        <div class="token-card">
          <div class="card-header">
            <span class="card-title">模型</span>
            <span class="card-badge">{{ currentApiPreset?.model || '未设置' }}</span>
          </div>
          <div class="card-content">
            <div class="stat-row" v-if="currentApiPreset">
              <span class="stat-label">温度</span>
              <span class="stat-value">{{ currentApiPreset.temperature }}</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">预设</span>
              <span class="stat-value">{{ currentApiPreset?.name || '未设置' }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.token-details-panel {
  position: fixed;
  top: 64px;
  right: 12px;
  z-index: 1000;
  pointer-events: none;
}

.token-details-overlay {
  display: none;
}

.token-details-content {
  position: relative;
  width: 260px;
  max-height: calc(100vh - 80px);
  overflow-y: auto;
  padding: 12px;
  box-sizing: border-box;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  pointer-events: auto;
}

.token-details-panel.light .token-details-content {
  background: #ffffff;
}

.token-details-panel.dark .token-details-content {
  background: #1c1c26;
}

/* 顶部关键指标 */
.token-summary {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 8px;
  margin-bottom: 12px;
  padding: 10px;
  border-radius: 8px;
}

.token-details-panel.light .token-summary {
  background: rgba(157, 141, 241, 0.08);
}

.token-details-panel.dark .token-summary {
  background: rgba(183, 163, 227, 0.08);
}

.summary-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.summary-main {
  grid-column: 1 / -1;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  background: rgba(157, 141, 241, 0.15);
  border-radius: 6px;
  gap: 12px;
}

.token-details-panel.dark .summary-main {
  background: rgba(183, 163, 227, 0.15);
}

.summary-main-left {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.progress-bar {
  width: 100%;
  height: 6px;
  background: rgba(157, 141, 241, 0.2);
  border-radius: 3px;
  overflow: hidden;
}

.token-details-panel.dark .progress-bar {
  background: rgba(183, 163, 227, 0.2);
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #10b981 0%, #34d399 50%, #f59e0b 80%, #ef4444 100%);
  border-radius: 3px;
  transition: width 0.3s ease;
}

.summary-label {
  font-size: 11px;
  font-weight: 500;
}

.token-details-panel.light .summary-label {
  color: #6b7280;
}

.token-details-panel.dark .summary-label {
  color: #9ca3af;
}

.summary-main .summary-label {
  font-size: 12px;
}

.summary-value {
  font-size: 14px;
  font-weight: 600;
}

.token-details-panel.light .summary-value {
  color: #1f2937;
}

.token-details-panel.dark .summary-value {
  color: #f3f4f6;
}

.summary-main .summary-value {
  font-size: 16px;
}

/* 卡片样式 */
.token-card {
  margin-bottom: 10px;
  border-radius: 8px;
  overflow: hidden;
  transition: all 0.2s ease;
}

.token-details-panel.light .token-card {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
}

.token-details-panel.dark .token-card {
  background: #23232f;
  border: 1px solid #2d2d3a;
}

.token-card.expandable {
  cursor: pointer;
}

.token-card.expandable:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  min-height: 36px;
}

.card-header.expandable {
  padding: 8px 10px;
}

.card-title {
  font-size: 12px;
  font-weight: 600;
}

.token-details-panel.light .card-title {
  color: #374151;
}

.token-details-panel.dark .card-title {
  color: #e5e7eb;
}

.card-right {
  display: flex;
  align-items: center;
  gap: 6px;
}

.card-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(157, 141, 241, 0.1);
}

.token-details-panel.light .card-badge {
  color: #9d8df1;
}

.token-details-panel.dark .card-badge {
  color: #b7a3e3;
}

.card-content {
  padding: 0 10px 8px;
}

.stat-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 0;
}

.stat-label {
  font-size: 11px;
}

.token-details-panel.light .stat-label {
  color: #6b7280;
}

.token-details-panel.dark .stat-label {
  color: #9ca3af;
}

.stat-value {
  font-size: 11px;
  font-weight: 500;
}

.token-details-panel.light .stat-value {
  color: #374151;
}

.token-details-panel.dark .stat-value {
  color: #e5e7eb;
}

.expand-icon {
  transition: transform 0.25s ease;
  flex-shrink: 0;
}

.expand-icon.expanded {
  transform: rotate(180deg);
}

.token-details-panel.light .expand-icon {
  color: #9ca3af;
}

.token-details-panel.dark .expand-icon {
  color: #6b7280;
}

/* 颜色类 */
.token-details-total {
  color: var(--accent-purple);
}

.token-details-panel.light .token-details-total {
  color: #9d8df1;
}

.token-details-panel.dark .token-details-total {
  color: #b7a3e3;
}

.token-details-percent {
  color: #10b981;
}

.token-details-panel.dark .token-details-percent {
  color: #34d399;
}

/* 滚动条样式 */
.token-details-content::-webkit-scrollbar {
  width: 3px;
}

.token-details-content::-webkit-scrollbar-track {
  background: transparent;
}

.token-details-content::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.15);
  border-radius: 2px;
}

.token-details-panel.dark .token-details-content::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
}

/* Slide-in from right top */
.slide-in-enter-active,
.slide-in-leave-active {
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.slide-in-enter-active .token-details-content {
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease;
}

.slide-in-leave-active .token-details-content {
  transition: transform 0.2s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.2s ease;
}

.slide-in-enter-from,
.slide-in-leave-to {
  opacity: 0;
}

.slide-in-enter-from .token-details-content,
.slide-in-leave-to .token-details-content {
  transform: translateX(20px) translateY(-10px);
}

/* Expand transition */
.expand-enter-active,
.expand-leave-active {
  transition: all 0.25s ease;
  max-height: 200px;
  overflow: hidden;
}

.expand-enter-from,
.expand-leave-to {
  max-height: 0;
  opacity: 0;
}
</style>