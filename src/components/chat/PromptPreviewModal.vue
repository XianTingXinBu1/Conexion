<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { X, Copy, Check, ChevronDown, ChevronUp, Search, XCircle } from 'lucide-vue-next';
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
  return text.replace(regex, '<mark class="highlight">$1</mark>');
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

const getRoleBadgeColor = (role: string) => {
  switch (role) {
    case 'system':
      return 'background: var(--accent-purple); color: white;';
    case 'user':
      return 'background: #3b82f6; color: white;';
    case 'assistant':
      return 'background: #10b981; color: white;';
    default:
      return 'background: var(--bg-tertiary); color: var(--text-main);';
  }
};

const tokenInfo = computed(() => {
  return props.estimatedTokens !== undefined
    ? `估计 Token 数: ${props.estimatedTokens.toLocaleString()}`
    : '';
});
</script>

<template>
  <Transition name="modal">
    <div v-if="show" class="modal-overlay" @click="closeModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h2 class="modal-title">提示词预览</h2>
          <button class="close-btn" @click="closeModal">
            <X :size="20" />
          </button>
        </div>

        <div class="modal-body">
          <div v-if="tokenInfo" class="token-info">
            {{ tokenInfo }}
          </div>

          <!-- 搜索框 -->
          <div class="search-box">
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
            暂无提示词数据
          </div>

          <div v-else-if="filteredMessages.length === 0" class="empty-state">
            未找到匹配的内容
          </div>

          <div v-else class="messages-list">
            <div
              v-for="(message, filteredIndex) in filteredMessages"
              :key="filteredIndex"
              class="message-item"
            >
              <div
                class="message-header"
                @click="toggleCollapse(filteredIndex)"
              >
                <div class="header-left">
                  <span class="role-badge" :style="getRoleBadgeColor(message.role)">
                    {{ getRoleLabel(message.role) }}
                  </span>
                  <span class="message-preview">
                    <span
                      v-if="collapsedMessages[filteredIndex]"
                      v-html="highlightText(message.content.slice(0, 50) + '...', searchQuery)"
                    />
                    <span v-else>点击展开/收起</span>
                  </span>
                </div>
                <ChevronDown v-if="collapsedMessages[filteredIndex]" :size="18" class="chevron" />
                <ChevronUp v-else :size="18" class="chevron" />
              </div>

              <Transition name="collapse">
                <div v-if="!collapsedMessages[filteredIndex]" class="message-content">
                  <pre v-html="highlightText(message.content, searchQuery)"></pre>
                </div>
              </Transition>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button class="action-btn secondary" @click="closeModal">
            关闭
          </button>
          <button class="action-btn primary" @click="copyPrompt" :disabled="!systemMessages || systemMessages.length === 0">
            <Check v-if="copied" :size="16" />
            <Copy v-else :size="16" />
            {{ copied ? '已复制' : '复制提示词' }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.modal-content {
  background: var(--bg-primary);
  border-radius: 16px;
  width: 100%;
  max-width: 600px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.modal-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-main);
  margin: 0;
}

.close-btn {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.close-btn:hover {
  background: var(--bg-tertiary);
  color: var(--text-main);
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.token-info {
  padding: 10px 14px;
  background: var(--bg-secondary);
  border-radius: 8px;
  font-size: 13px;
  color: var(--text-muted);
  border-left: 3px solid var(--accent-purple);
}

.prompt-content {
  flex: 1;
  overflow-y: auto;
  background: var(--bg-secondary);
  border-radius: 12px;
  padding: 16px;
  border: 1px solid var(--border-color);
}

.prompt-content pre {
  margin: 0;
  white-space: pre-wrap;
  word-wrap: break-word;
  font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, monospace;
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-main);
}

.modal-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid var(--border-color);
  flex-shrink: 0;
}

.action-btn {
  padding: 10px 16px;
  border-radius: 8px;
  border: none;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.2s ease;
}

.action-btn.secondary {
  background: var(--bg-secondary);
  color: var(--text-main);
  border: 1px solid var(--border-color);
}

.action-btn.secondary:hover {
  background: var(--bg-tertiary);
}

.action-btn.primary {
  background: var(--accent-purple);
  color: white;
}

.action-btn.primary:hover:not(:disabled) {
  filter: brightness(1.05);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(157, 141, 241, 0.3);
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Modal transition */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;
}

.modal-enter-active .modal-content,
.modal-leave-active .modal-content {
  transition: transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal-content,
.modal-leave-to .modal-content {
  transform: scale(0.95) translateY(10px);
}

/* Scrollbar */
.modal-body::-webkit-scrollbar,
.prompt-content::-webkit-scrollbar {
  width: 6px;
}

.modal-body::-webkit-scrollbar-track,
.prompt-content::-webkit-scrollbar-track {
  background: transparent;
}

.modal-body::-webkit-scrollbar-thumb,
.prompt-content::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 4px;
}

.modal-body::-webkit-scrollbar-thumb:hover,
.prompt-content::-webkit-scrollbar-thumb:hover {
  background: var(--text-muted);
}

/* Empty state */
.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: var(--text-muted);
  font-size: 14px;
}

/* Messages list */
.messages-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* Message item */
.message-item {
  background: var(--bg-secondary);
  border-radius: 12px;
  border: 1px solid var(--border-color);
  overflow: hidden;
  transition: all 0.2s ease;
}

.message-item:hover {
  border-color: var(--accent-purple);
}

/* Message header */
.message-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  cursor: pointer;
  user-select: none;
  transition: background-color 0.2s ease;
}

.message-header:hover {
  background: var(--bg-tertiary);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.role-badge {
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  flex-shrink: 0;
}

.message-preview {
  font-size: 13px;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chevron {
  color: var(--text-muted);
  flex-shrink: 0;
  transition: transform 0.3s ease;
}

/* Message content */
.message-content {
  padding: 0 16px 16px;
  border-top: 1px solid var(--border-color);
  background: var(--bg-tertiary);
}

.message-content pre {
  margin: 0;
  padding-top: 16px;
  white-space: pre-wrap;
  word-wrap: break-word;
  font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, monospace;
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-main);
}

/* Collapse transition */
.collapse-enter-active,
.collapse-leave-active {
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  max-height: 500px;
  overflow: hidden;
}

.collapse-enter-from,
.collapse-leave-to {
  max-height: 0;
  opacity: 0;
}

/* Search box */
.search-box {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  transition: all 0.2s ease;
}

.search-box:focus-within {
  border-color: var(--accent-purple);
  box-shadow: 0 0 0 3px rgba(157, 141, 241, 0.15);
}

.search-icon {
  color: var(--text-muted);
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  border: none;
  background: transparent;
  outline: none;
  font-size: 14px;
  color: var(--text-main);
  min-width: 0;
}

.search-input::placeholder {
  color: var(--text-muted);
  opacity: 0.7;
}

.clear-icon {
  color: var(--text-muted);
  cursor: pointer;
  flex-shrink: 0;
  transition: color 0.2s ease;
}

.clear-icon:hover {
  color: var(--text-main);
}

/* Highlight */
:deep(.highlight) {
  background: rgba(255, 215, 0, 0.3);
  color: var(--text-main);
  padding: 1px 2px;
  border-radius: 2px;
  font-weight: 500;
}

[data-theme='dark'] :deep(.highlight) {
  background: rgba(255, 215, 0, 0.4);
}
</style>