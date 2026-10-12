<script setup lang="ts">
import { computed } from 'vue';
import type { Message, Theme } from '@/types';
import { MarkdownRenderer } from '@/modules/markdown';
import { ChevronLeft, ChevronRight, Edit2, RefreshCw, Trash2 } from '@lucide/vue';

interface Props {
  message: Message;
  index: number;
  totalMessages: number;
  displayCount: number;
  theme: Theme;
  enableMarkdown: boolean;
  showWordCount: boolean;
  showMessageIndex: boolean;
  /** 是否显示重试入口，由页面判定（只有末尾的 AI 回复为 true） */
  canRetry?: boolean;
  /** 变体总数，大于 1 时显示左右切换 */
  variantCount?: number;
  /** 当前变体下标（0 基） */
  variantIndex?: number;
  variantSwitchDisabled?: boolean;
  actionsDisabled?: boolean;
  userName?: string;
  aiName?: string;
}

const props = withDefaults(defineProps<Props>(), {
  canRetry: false,
  variantCount: 1,
  variantIndex: 0,
  variantSwitchDisabled: false,
  actionsDisabled: false,
  userName: '用户',
  aiName: 'AI',
});

const emit = defineEmits<{
  'edit': [messageId: string];
  'delete': [messageId: string];
  'retry': [messageId: string];
  'switchVariant': [messageId: string, delta: number];
}>();

/** 横向滑动多少像素才算切换，避免和竖向滚动抢手势 */
const SWIPE_THRESHOLD = 40;

let swipeStart: { x: number; y: number } | null = null;

const handleTouchStart = (event: TouchEvent) => {
  if (props.variantSwitchDisabled || props.variantCount <= 1) return;

  const touch = event.touches[0];
  if (!touch) return;

  swipeStart = { x: touch.clientX, y: touch.clientY };
};

const handleTouchEnd = (event: TouchEvent) => {
  const start = swipeStart;
  swipeStart = null;

  if (!start || props.variantSwitchDisabled) return;

  const touch = event.changedTouches[0];
  if (!touch) return;

  const deltaX = touch.clientX - start.x;
  const deltaY = touch.clientY - start.y;

  // 竖向为主的手势留给页面滚动；横向位移不够也不算切换
  if (Math.abs(deltaX) < SWIPE_THRESHOLD || Math.abs(deltaX) <= Math.abs(deltaY)) return;

  emit('switchVariant', props.message.id, deltaX < 0 ? 1 : -1);
};

const handleTouchCancel = () => {
  swipeStart = null;
};

const switchVariant = (delta: number) => {
  if (!props.variantSwitchDisabled) {
    emit('switchVariant', props.message.id, delta);
  }
};

const isStreamingMessage = computed(() => props.index === props.displayCount - 1);

const getWordCount = (text: string) => {
  return text.length;
};

const messageLabel = computed(() => {
  if (props.message.type === 'user') {
    return props.userName?.trim() || '用户';
  }

  if (props.message.type === 'system') {
    return '系统';
  }

  return props.aiName?.trim() || 'AI';
});
</script>

<template>
  <div
    :class="['message-item', `message-${message.type}`]"
    @touchstart.passive="handleTouchStart"
    @touchend="handleTouchEnd"
    @touchcancel="handleTouchCancel"
  >
    <div class="message-content">
      <MarkdownRenderer
        v-if="enableMarkdown"
        :content="message.content"
        :streaming="isStreamingMessage"
      />
      <span v-else>{{ message.content }}</span>
    </div>
    <div class="message-meta">
      <div class="message-label">{{ messageLabel }}</div>
      <div v-if="showWordCount" class="message-word-count">{{ getWordCount(message.content) }} 字</div>
      <div v-if="showMessageIndex" class="message-index">#{{ totalMessages - displayCount + index + 1 }}</div>
    </div>
    <div class="message-footer">
      <button v-if="variantCount > 1" class="variant-btn" :disabled="variantSwitchDisabled" title="上一条回复" @click="switchVariant(-1)">
        <ChevronLeft :size="18" />
      </button>
      <div class="message-actions">
        <button v-if="canRetry" class="action-btn" @click="emit('retry', message.id)" title="重新生成">
          <RefreshCw :size="14" />
        </button>
        <button class="action-btn" :disabled="actionsDisabled" @click="$emit('edit', message.id)" title="编辑">
          <Edit2 :size="14" />
        </button>
        <button class="action-btn" :disabled="actionsDisabled" @click="$emit('delete', message.id)" title="删除">
          <Trash2 :size="14" />
        </button>
        <span v-if="variantCount > 1" class="variant-indicator">{{ variantIndex + 1 }}/{{ variantCount }}</span>
      </div>
      <button v-if="variantCount > 1" class="variant-btn" :disabled="variantSwitchDisabled" title="下一条回复" @click="switchVariant(1)">
        <ChevronRight :size="18" />
      </button>
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
  flex-direction: column;
  align-items: stretch;
  gap: 6px;
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
  width: 100%;
  min-width: 0;
  padding: 0;
  line-height: 1.5;
  font-size: 14px;
  word-wrap: break-word;
  overflow-wrap: break-word;
}

.message-user .message-content {
  text-align: right;
}

.message-user .message-meta,
.message-user .message-actions {
  justify-content: flex-end;
}

.message-meta {
  display: flex;
  align-items: center;
  gap: 8px;
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
  align-items: center;
  flex: 1;
}

.action-btn {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  border: none;
  background: transparent;
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

.action-btn:disabled {
  opacity: 0.4;
  cursor: default;
}

.action-btn:active {
  transform: scale(0.9);
}

/* 操作位于正文下方，版本箭头分居两端。 */
.message-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.variant-btn {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--accent-purple);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s ease;
}

.variant-btn:disabled {
  opacity: 0.4;
  cursor: default;
}

.variant-btn:hover:not(:disabled) {
  background: var(--accent-soft);
}

.variant-btn:active {
  transform: scale(0.9);
}

.variant-indicator {
  font-size: 11px;
  font-weight: 600;
  color: var(--accent-purple);
  white-space: nowrap;
  margin-left: auto;
  text-align: center;
}
</style>