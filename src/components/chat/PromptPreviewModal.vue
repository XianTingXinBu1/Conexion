<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import DOMPurify from 'dompurify';
import { X, Copy, Check, ChevronDown, ChevronUp, Search, XCircle, RefreshCw, Zap, FileText, SearchX } from 'lucide-vue-next';
import type { ChatMessage } from '../../types';

interface Props {
  show: boolean;
  systemMessages?: ChatMessage[];
  estimatedTokens?: number;
  theme?: 'light' | 'dark';
}

const props = defineProps<Props>();

const emit = defineEmits<{
  'update:show': [value: boolean];
  refresh: [];
}>();

const copied = ref(false);
const collapsedMessages = ref<Record<number, boolean>>({});
const searchQuery = ref('');

// 过滤后的消息列表
const filteredMessages = computed(() => {
  if (!props.systemMessages) return [];

  if (!searchQuery.value.trim()) {
    return props.systemMessages;
  }

  const query = searchQuery.value.toLowerCase();
  return props.systemMessages.filter(msg =>
    msg.content.toLowerCase().includes(query) ||
    msg.role.toLowerCase().includes(query)
  );
});

// 高亮匹配的文本
const highlightText = (text: string, query: string) => {
  if (!query.trim()) return text;

  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const highlighted = text.replace(regex, '<mark class="highlight">$1</mark>');
  // 使用 DOMPurify 清洗 HTML，只允许 <mark> 标签
  return DOMPurify.sanitize(highlighted, { ALLOWED_TAGS: ['mark'], ALLOWED_ATTR: ['class'] });
};

// 初始化折叠状态，默认全部折叠
watch(() => props.systemMessages, (messages) => {
  if (messages) {
    collapsedMessages.value = {};
    messages.forEach((_, index) => {
      collapsedMessages.value[index] = true; // true 表示折叠
    });
  }
}, { immediate: true });

// 搜索时自动展开匹配的消息
watch(searchQuery, (query) => {
  if (query.trim() && props.systemMessages) {
    const queryLower = query.toLowerCase();
    props.systemMessages.forEach((msg, index) => {
      if (msg.content.toLowerCase().includes(queryLower) ||
          msg.role.toLowerCase().includes(queryLower)) {
        collapsedMessages.value[index] = false; // 展开匹配的消息
      }
    });
  }
});

const clearSearch = () => {
  searchQuery.value = '';
};

const handleRefresh = () => {
  emit('refresh');
};

const closeModal = () => {
  emit('update:show', false);
  copied.value = false;
};

const copyPrompt = async () => {
  if (!props.systemMessages || props.systemMessages.length === 0) return;

  const promptText = props.systemMessages
    .map(msg => `[${msg.role.toUpperCase()}]\n${msg.content}`)
    .join('\n\n---\n\n');

  try {
    await navigator.clipboard.writeText(promptText);
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 2000);
  } catch (error) {
    console.error('复制失败:', error);
  }
};

const toggleCollapse = (index: number) => {
  collapsedMessages.value[index] = !collapsedMessages.value[index];
};

const getRoleLabel = (role: string) => {
  switch (role) {
    case 'system':
      return '系统';
    case 'user':
      return '用户';
    case 'assistant':
      return '助手';
    default:
      return role;
  }
};

const getRoleColor = (role: string) => {
  switch (role) {
    case 'system':
      return 'var(--accent-purple)';
    case 'user':
      return 'var(--role-user-color)';
    case 'assistant':
      return 'var(--role-assistant-color)';
    default:
      return 'var(--text-muted)';
  }
};

const tokenInfo = computed(() => {
  return props.estimatedTokens !== undefined
    ? `${props.estimatedTokens.toLocaleString()} tokens`
    : '';
});

// 辅助函数：截断文本
const truncateText = (text: string, maxLength: number) => {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
};
</script>

<template>
  <Transition name="modal">
    <div v-if="show" class="modal-overlay" @click="closeModal">
      <div class="modal-content" @click.stop>
        <!-- 背景装饰 -->
        <div class="modal-bg-decorator"></div>

        <div class="modal-header">
          <div class="header-left">
            <h2 class="modal-title">提示词预览</h2>
            <div v-if="tokenInfo" class="token-badge">
              <Zap :size="14" />
              <span>{{ tokenInfo }}</span>
            </div>
          </div>
          <div class="header-actions">
            <button class="icon-btn" @click="handleRefresh" title="刷新提示词">
              <RefreshCw :size="18" />
            </button>
            <button class="icon-btn" @click="closeModal">
              <X :size="20" />
            </button>
          </div>
        </div>

        <div class="modal-body">
          <!-- 搜索框 -->
          <div class="search-container">
            <Search :size="16" class="search-icon" />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="搜索提示词内容..."
              class="search-input"
            />
            <XCircle
              v-if="searchQuery"
              :size="16"
              class="clear-icon"
              @click="clearSearch"
            />
          </div>

          <div v-if="!systemMessages || systemMessages.length === 0" class="empty-state">
            <FileText :size="48" class="empty-icon" />
            <p class="empty-text">暂无提示词数据</p>
          </div>

          <div v-else-if="filteredMessages.length === 0" class="empty-state">
            <SearchX :size="48" class="empty-icon" />
            <p class="empty-text">未找到匹配的内容</p>
          </div>

          <div v-else class="messages-list">
            <div
              v-for="(message, filteredIndex) in filteredMessages"
              :key="filteredIndex"
              class="message-card"
            >
              <div
                class="message-header"
                :class="{ expanded: !collapsedMessages[filteredIndex] }"
                @click="toggleCollapse(filteredIndex)"
              >
                <div class="message-title">
                  <span class="role-dot" :style="{ backgroundColor: getRoleColor(message.role) }"></span>
                  <span class="role-label">{{ getRoleLabel(message.role) }}</span>
                  <span class="message-separator">·</span>
                  <span class="message-preview">
                    <span v-if="collapsedMessages[filteredIndex]" v-html="highlightText(truncateText(message.content, 60), searchQuery)" />
                    <span v-else class="expand-hint">点击收起</span>
                  </span>
                </div>
                <ChevronDown
                  v-if="collapsedMessages[filteredIndex]"
                  :size="18"
                  class="chevron-icon"
                />
                <ChevronUp v-else :size="18" class="chevron-icon" />
              </div>

              <Transition name="slide">
                <div v-if="!collapsedMessages[filteredIndex]" class="message-body">
                  <pre v-html="highlightText(message.content, searchQuery)" class="message-content"></pre>
                </div>
              </Transition>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" @click="closeModal">
            关闭
          </button>
          <button
            class="btn btn-primary"
            @click="copyPrompt"
            :disabled="!systemMessages || systemMessages.length === 0"
            :class="{ 'btn-copied': copied }"
          >
            <Check v-if="copied" :size="16" />
            <Copy v-else :size="16" />
            {{ copied ? '已复制' : '复制全部' }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
/* ========== 变量定义 ========== */
:root {
  --role-user-color: #6366f1;
  --role-assistant-color: #10b981;
  --modal-backdrop: rgba(0, 0, 0, 0.6);
  --modal-shadow: 0 24px 48px rgba(0, 0, 0, 0.2);
  --card-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  --card-shadow-hover: 0 4px 16px rgba(0, 0, 0, 0.08);
  --transition-smooth: cubic-bezier(0.16, 1, 0.3, 1);
}

[data-theme='dark'] {
  --modal-backdrop: rgba(0, 0, 0, 0.75);
  --modal-shadow: 0 24px 48px rgba(0, 0, 0, 0.4);
  --card-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  --card-shadow-hover: 0 4px 16px rgba(0, 0, 0, 0.3);
}

/* ========== Modal Overlay ========== */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: var(--modal-backdrop);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 16px;
}

/* ========== Modal Content ========== */
.modal-content {
  position: relative;
  background: var(--bg-primary);
  border-radius: 20px;
  width: 100%;
  max-width: 640px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  box-shadow: var(--modal-shadow);
  overflow: hidden;
  animation: modalSlideIn 0.4s var(--transition-smooth);
}

.modal-bg-decorator {
  position: absolute;
  top: 0;
  right: 0;
  width: 200px;
  height: 200px;
  background: radial-gradient(circle, var(--accent-purple) 0%, transparent 70%);
  opacity: 0.05;
  pointer-events: none;
  filter: blur(40px);
}

/* ========== Modal Header ========== */
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
  position: relative;
  z-index: 1;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.modal-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-main);
  margin: 0;
  letter-spacing: -0.02em;
}

.token-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: linear-gradient(135deg, var(--accent-purple), #a78bfa);
  color: white;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
  box-shadow: 0 2px 8px rgba(157, 141, 241, 0.3);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.icon-btn {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  border: none;
  background: var(--bg-secondary);
  color: var(--text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s var(--transition-smooth);
}

.icon-btn:hover {
  background: var(--bg-tertiary);
  color: var(--text-main);
  transform: translateY(-1px);
}

.icon-btn:active {
  transform: scale(0.95);
}

/* ========== Modal Body ========== */
.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* ========== Search Container ========== */
.search-container {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  background: var(--bg-secondary);
  border: 2px solid transparent;
  border-radius: 12px;
  transition: all 0.25s var(--transition-smooth);
  position: relative;
}

.search-container:focus-within {
  border-color: var(--accent-purple);
  background: var(--bg-primary);
  box-shadow: 0 0 0 4px rgba(157, 141, 241, 0.1);
}

.search-icon {
  color: var(--text-muted);
  flex-shrink: 0;
  transition: color 0.2s ease;
}

.search-container:focus-within .search-icon {
  color: var(--accent-purple);
}

.search-input {
  flex: 1;
  border: none;
  background: transparent;
  outline: none;
  font-size: 14px;
  color: var(--text-main);
  min-width: 0;
  padding: 0;
}

.search-input::placeholder {
  color: var(--text-muted);
  opacity: 0.6;
}

.clear-icon {
  color: var(--text-muted);
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.2s ease;
  padding: 2px;
}

.clear-icon:hover {
  color: var(--text-main);
  transform: scale(1.1);
}

/* ========== Empty State ========== */
.empty-state {
  text-align: center;
  padding: 48px 20px;
  color: var(--text-muted);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.empty-icon {
  opacity: 0.4;
  stroke-width: 1.5;
}

.empty-text {
  font-size: 14px;
  margin: 0;
}

/* ========== Messages List ========== */
.messages-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* ========== Message Card ========== */
.message-card {
  background: var(--bg-secondary);
  border-radius: 14px;
  border: 1px solid var(--border-color);
  overflow: hidden;
  transition: all 0.3s var(--transition-smooth);
  box-shadow: var(--card-shadow);
}

.message-card:hover {
  border-color: var(--accent-purple);
  box-shadow: var(--card-shadow-hover);
  transform: translateY(-2px);
}

.message-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  cursor: pointer;
  user-select: none;
  transition: background-color 0.2s ease;
}

.message-header:hover {
  background: var(--bg-tertiary);
}

.message-header.expanded {
  background: var(--bg-tertiary);
}

.message-title {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.role-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  box-shadow: 0 0 8px currentColor;
}

.role-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-main);
  white-space: nowrap;
  flex-shrink: 0;
}

.message-separator {
  color: var(--text-muted);
  font-size: 14px;
  flex-shrink: 0;
}

.message-preview {
  font-size: 13px;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}

.expand-hint {
  color: var(--accent-purple);
  font-weight: 500;
}

.chevron-icon {
  color: var(--text-muted);
  flex-shrink: 0;
  transition: transform 0.3s var(--transition-smooth);
}

/* ========== Message Body ========== */
.message-body {
  border-top: 1px solid var(--border-color);
  background: var(--bg-primary);
}

.message-content {
  margin: 0;
  padding: 16px 18px;
  white-space: pre-wrap;
  word-wrap: break-word;
  font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, monospace;
  font-size: 13px;
  line-height: 1.7;
  color: var(--text-main);
}

/* ========== Modal Footer ========== */
.modal-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  padding: 20px 24px;
  border-top: 1px solid var(--border-color);
  flex-shrink: 0;
  position: relative;
  z-index: 1;
}

/* ========== Buttons ========== */
.btn {
  padding: 10px 18px;
  border-radius: 10px;
  border: none;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.25s var(--transition-smooth);
  font-family: inherit;
}

.btn-secondary {
  background: var(--bg-secondary);
  color: var(--text-main);
  border: 1px solid var(--border-color);
}

.btn-secondary:hover {
  background: var(--bg-tertiary);
  border-color: var(--text-muted);
  transform: translateY(-1px);
}

.btn-primary {
  background: linear-gradient(135deg, var(--accent-purple), #a78bfa);
  color: white;
  box-shadow: 0 4px 12px rgba(157, 141, 241, 0.3);
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(157, 141, 241, 0.4);
}

.btn-primary:active:not(:disabled) {
  transform: translateY(0);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.btn-copied {
  background: linear-gradient(135deg, #10b981, #34d399) !important;
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3) !important;
}

/* ========== Transitions ========== */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.slide-enter-active,
.slide-leave-active {
  transition: all 0.3s var(--transition-smooth);
  overflow: hidden;
  max-height: 600px;
}

.slide-enter-from,
.slide-leave-to {
  max-height: 0;
  opacity: 0;
}

@keyframes modalSlideIn {
  from {
    opacity: 0;
    transform: scale(0.92) translateY(20px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

/* ========== Scrollbar ========== */
.modal-body::-webkit-scrollbar {
  width: 6px;
}

.modal-body::-webkit-scrollbar-track {
  background: transparent;
}

.modal-body::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 4px;
  transition: background 0.2s ease;
}

.modal-body::-webkit-scrollbar-thumb:hover {
  background: var(--text-muted);
}

/* ========== Highlight ========== */
:deep(.highlight) {
  background: linear-gradient(135deg, rgba(251, 191, 36, 0.3), rgba(251, 191, 36, 0.15));
  color: var(--text-main);
  padding: 1px 3px;
  border-radius: 3px;
  font-weight: 500;
  border: 1px solid rgba(251, 191, 36, 0.2);
}

[data-theme='dark'] :deep(.highlight) {
  background: linear-gradient(135deg, rgba(251, 191, 36, 0.4), rgba(251, 191, 36, 0.2));
  border-color: rgba(251, 191, 36, 0.3);
}

/* ========== Utility ========== */
.truncate-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>