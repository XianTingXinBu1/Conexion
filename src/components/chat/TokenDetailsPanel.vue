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
        <div class="token-details-header">
          <div class="token-details-title">Token 用量</div>
          <button class="close-btn" @click="emit('close')">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- 当前会话统计 -->
        <div class="token-details-section">
          <div class="token-details-section-title">当前会话</div>
          <div class="token-details-item">
            <span class="token-details-label">总使用量</span>
            <span class="token-details-value token-details-total">{{ currentContextCount.toLocaleString() }}</span>
          </div>
          <div class="token-details-item">
            <span class="token-details-label">使用率</span>
            <span class="token-details-value token-details-percent">{{ Math.round((currentContextCount / maxContextLength) * 100) }}%</span>
          </div>
          <div class="token-details-item">
            <span class="token-details-label">剩余可用</span>
            <span class="token-details-value">{{ remainingTokens.toLocaleString() }}</span>
          </div>
          <div class="token-details-item">
            <span class="token-details-label">最大上下文</span>
            <span class="token-details-value">{{ maxContextLength.toLocaleString() }}</span>
          </div>
        </div>

        <!-- 本次请求统计 -->
        <div class="token-details-section" v-if="usage">
          <div class="token-details-section-title">本次请求</div>
          <div class="token-details-item">
            <span class="token-details-label">输入 Token</span>
            <span class="token-details-value">{{ usage.promptTokens.toLocaleString() }}</span>
          </div>
          <div class="token-details-item">
            <span class="token-details-label">输出 Token</span>
            <span class="token-details-value">{{ usage.completionTokens.toLocaleString() }}</span>
          </div>
          <div class="token-details-item">
            <span class="token-details-label">本次总计</span>
            <span class="token-details-value token-details-total">{{ usage.totalTokens.toLocaleString() }}</span>
          </div>
        </div>

        <!-- 聊天历史统计 -->
        <div class="token-details-section">
          <div class="token-details-section-title">聊天历史</div>
          <div class="token-details-item token-details-expandable" @click="toggleSection('chatHistory')">
            <span class="token-details-label">总消息数</span>
            <div class="token-details-value-wrapper">
              <span class="token-details-value">{{ chatMessageCount }}</span>
              <svg :class="['expand-icon', { expanded: expandedSections.chatHistory }]" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </div>
          </div>
          <Transition name="expand">
            <div v-if="expandedSections.chatHistory" class="token-details-subsection">
              <div class="token-details-subitem">
                <span class="token-details-sublabel">用户消息</span>
                <span class="token-details-subvalue">{{ userMessageCount }} 条 / {{ userTokens.toLocaleString() }} Token</span>
              </div>
              <div class="token-details-subitem">
                <span class="token-details-sublabel">AI 消息</span>
                <span class="token-details-subvalue">{{ aiMessageCount }} 条 / {{ aiTokens.toLocaleString() }} Token</span>
              </div>
            </div>
          </Transition>
        </div>

        <!-- 提示词统计 -->
        <div class="token-details-section" v-if="lastSystemPromptResult">
          <div class="token-details-section-title">提示词统计</div>
          <div class="token-details-item token-details-expandable" @click="toggleSection('promptDetails')">
            <span class="token-details-label">系统提示词</span>
            <div class="token-details-value-wrapper">
              <span class="token-details-value">{{ lastSystemPromptResult.estimatedTokens.toLocaleString() }} Token</span>
              <svg :class="['expand-icon', { expanded: expandedSections.promptDetails }]" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </div>
          </div>
          <Transition name="expand">
            <div v-if="expandedSections.promptDetails && lastSystemPromptResult.metadata" class="token-details-subsection">
              <div class="token-details-subitem" v-if="lastSystemPromptResult.metadata.filledPlaceholders?.character">
                <span class="token-details-sublabel">角色设定</span>
                <span class="token-details-subvalue">{{ lastSystemPromptResult.metadata.filledPlaceholders.character.contentLength.toLocaleString() }} Token</span>
              </div>
              <div class="token-details-subitem" v-if="lastSystemPromptResult.metadata.filledPlaceholders?.user">
                <span class="token-details-sublabel">用户设定</span>
                <span class="token-details-subvalue">{{ lastSystemPromptResult.metadata.filledPlaceholders.user.contentLength.toLocaleString() }} Token</span>
              </div>
              <div class="token-details-subitem" v-if="lastSystemPromptResult.metadata.filledPlaceholders?.knowledge">
                <span class="token-details-sublabel">知识库</span>
                <span class="token-details-subvalue">{{ lastSystemPromptResult.metadata.filledPlaceholders.knowledge.contentLength.toLocaleString() }} Token</span>
              </div>
              <div class="token-details-subitem">
                <span class="token-details-sublabel">启用条目</span>
                <span class="token-details-subvalue">{{ lastSystemPromptResult.metadata.enabledItems }} / {{ lastSystemPromptResult.metadata.totalItems }}</span>
              </div>
            </div>
          </Transition>
        </div>

        <!-- 模型信息 -->
        <div class="token-details-section">
          <div class="token-details-section-title">模型信息</div>
          <div class="token-details-item">
            <span class="token-details-label">当前模型</span>
            <span class="token-details-value">{{ currentApiPreset?.model || '未设置' }}</span>
          </div>
          <div class="token-details-item" v-if="currentApiPreset">
            <span class="token-details-label">温度参数</span>
            <span class="token-details-value">{{ currentApiPreset.temperature }}</span>
          </div>
          <div class="token-details-item">
            <span class="token-details-label">API 预设</span>
            <span class="token-details-value">{{ currentApiPreset?.name || '未设置' }}</span>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.token-details-panel {
  position: fixed;
  top: 0;
  right: 0;
  width: 100%;
  height: 100%;
  z-index: 1000;
  display: flex;
  justify-content: flex-end;
}

.token-details-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
}

.token-details-content {
  position: relative;
  width: 90%;
  max-width: 400px;
  height: 100%;
  overflow-y: auto;
  padding: 20px;
  box-sizing: border-box;
}

.token-details-panel.light .token-details-content {
  background: #ffffff;
}

.token-details-panel.dark .token-details-content {
  background: #1c1c26;
}

.token-details-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 1px solid;
}

.token-details-panel.light .token-details-header {
  border-color: #e5e7eb;
}

.token-details-panel.dark .token-details-header {
  border-color: #2d2d3a;
}

.token-details-title {
  font-size: 18px;
  font-weight: 600;
}

.token-details-panel.light .token-details-title {
  color: #1f2937;
}

.token-details-panel.dark .token-details-title {
  color: #f3f4f6;
}

.close-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.token-details-panel.light .close-btn {
  color: #6b7280;
}

.token-details-panel.dark .close-btn {
  color: #9ca3af;
}

.close-btn:hover {
  background-color: rgba(0, 0, 0, 0.1);
}

.token-details-section {
  margin-bottom: 20px;
}

.token-details-section-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.token-details-panel.light .token-details-section-title {
  color: #6b7280;
}

.token-details-panel.dark .token-details-section-title {
  color: #9ca3af;
}

.token-details-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid;
}

.token-details-panel.light .token-details-item {
  border-color: #f3f4f6;
}

.token-details-panel.dark .token-details-item {
  border-color: #2d2d3a;
}

.token-details-item:last-child {
  border-bottom: none;
}

.token-details-expandable {
  cursor: pointer;
  user-select: none;
  transition: background-color 0.2s;
}

.token-details-expandable:hover {
  background-color: rgba(0, 0, 0, 0.05);
  margin: 0 -10px;
  padding: 10px;
}

.token-details-label {
  font-size: 14px;
}

.token-details-panel.light .token-details-label {
  color: #4b5563;
}

.token-details-panel.dark .token-details-label {
  color: #d1d5db;
}

.token-details-value {
  font-size: 14px;
  font-weight: 500;
}

.token-details-panel.light .token-details-value {
  color: #1f2937;
}

.token-details-panel.dark .token-details-value {
  color: #f3f4f6;
}

.token-details-total {
  font-weight: 600;
}

.token-details-panel.light .token-details-total {
  color: #9d8df1;
}

.token-details-panel.dark .token-details-total {
  color: #b7a3e3;
}

.token-details-percent {
  font-weight: 600;
}

.token-details-panel.light .token-details-percent {
  color: #10b981;
}

.token-details-panel.dark .token-details-percent {
  color: #34d399;
}

.token-details-value-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
}

.expand-icon {
  transition: transform 0.3s ease;
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

.token-details-subsection {
  margin-top: 10px;
  padding-left: 20px;
}

.token-details-subitem {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
}

.token-details-sublabel {
  font-size: 13px;
}

.token-details-panel.light .token-details-sublabel {
  color: #6b7280;
}

.token-details-panel.dark .token-details-sublabel {
  color: #9ca3af;
}

.token-details-subvalue {
  font-size: 13px;
  font-weight: 500;
}

.token-details-panel.light .token-details-subvalue {
  color: #4b5563;
}

.token-details-panel.dark .token-details-subvalue {
  color: #d1d5db;
}

/* Slide-in transition */
.slide-in-enter-active,
.slide-in-leave-active {
  transition: all 0.3s ease;
}

.slide-in-enter-from,
.slide-in-leave-to {
  opacity: 0;
}

.slide-in-enter-from .token-details-content,
.slide-in-leave-to .token-details-content {
  transform: translateX(100%);
}

/* Expand transition */
.expand-enter-active,
.expand-leave-active {
  transition: all 0.3s ease;
  max-height: 300px;
  overflow: hidden;
}

.expand-enter-from,
.expand-leave-to {
  max-height: 0;
  opacity: 0;
}
</style>