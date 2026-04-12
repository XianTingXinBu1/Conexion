<script setup lang="ts">
import { computed } from 'vue';
import type { Message, Theme } from '../../types';
import { MarkdownRenderer } from '@/modules/markdown';
import { Edit2, Trash2 } from 'lucide-vue-next';

interface Props {
  message: Message;
  index: number;
  totalMessages: number;
  displayCount: number;
  theme: Theme;
  enableMarkdown: boolean;
  showWordCount: boolean;
  showMessageIndex: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  'edit': [messageId: string];
  'delete': [messageId: string];
}>();

const isStreamingMessage = computed(() => props.index === props.displayCount - 1);

const getWordCount = (text: string) => {
  return text.length;
};
</script>

<template>
  <div :class="['message-item', `message-${message.type}`]">
    <div class="message-content">
      <MarkdownRenderer
        v-if="enableMarkdown"
        :content="message.content"
        :streaming="isStreamingMessage"
      />
      <span v-else>{{ message.content }}</span>
    </div>
    <div class="message-meta">
      <div class="message-label">{{ message.type === 'user' ? '用户' : 'AI' }}</div>
      <div v-if="showWordCount" class="message-word-count">{{ getWordCount(message.content) }} 字</div>
      <div v-if="showMessageIndex" class="message-index">#{{ totalMessages - displayCount + index + 1 }}</div>
      <div class="message-actions">
        <button class="action-btn" @click="$emit('edit', message.id)" title="编辑">
          <Edit2 :size="14" />
        </button>
        <button class="action-btn" @click="$emit('delete', message.id)" title="删除">
          <Trash2 :size="14" />
        </button>
      </div>
    </div>
  </div>
</template>

<style>
@import '@/modules/markdown/styles/index.css';
</style>

<style scoped>
.message-item {
  display: flex;
  max-width: 100%;
  align-items: flex-start;
  gap: 10px;
  animation: messageSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  justify-content: space-between;
}

@keyframes messageSlideIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.message-content {
  max-width: 80%;
  padding: 0;
  line-height: 1.5;
  font-size: 14px;
  word-wrap: break-word;
  overflow-wrap: break-word;
}

.message-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  flex-shrink: 0;
}

.message-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  white-space: nowrap;
}

.message-word-count {
  font-size: 11px;
  font-weight: 500;
  color: var(--text-muted);
  white-space: nowrap;
}

.message-index {
  font-size: 11px;
  font-weight: 500;
  color: var(--accent-purple);
  white-space: nowrap;
  background: rgba(157, 141, 241, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
}

.message-actions {
  display: flex;
  gap: 4px;
  margin-top: 2px;
}

.action-btn {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  border: none;
  background: var(--bg-primary);
  color: var(--text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.action-btn:hover {
  background: var(--accent-soft);
  color: var(--accent-purple);
}

.action-btn:active {
  transform: scale(0.9);
}
</style>