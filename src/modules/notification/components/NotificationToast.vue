<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { X, Info, AlertTriangle, AlertCircle, CheckCircle } from 'lucide-vue-next';
import type { NotificationItem } from '../types';
import { MarkdownRenderer } from '@/modules/markdown';
import { useNotifications } from '../useNotifications';

interface Props {
  notification: NotificationItem;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  close: [id: string];
}>();

// 使用通知管理
const { pauseNotification, resumeNotification } = useNotifications();

// 进度条剩余时间（毫秒）
const remainingTime = ref(props.notification.duration || 0);

// 进度条宽度百分比
const progressWidth = computed(() => {
  const duration = props.notification.duration || 0;
  return duration > 0 ? (remainingTime.value / duration) * 100 : 0;
});

// 是否暂停状态
const isPaused = computed(() => props.notification.paused === true);

// 定时器引用
let progressTimer: number | null = null;

/**
 * 获取通知图标组件
 */
const getIconComponent = () => {
  switch (props.notification.type) {
    case 'info':
      return Info;
    case 'warning':
      return AlertTriangle;
    case 'error':
      return AlertCircle;
    case 'success':
      return CheckCircle;
    default:
      return Info;
  }
};

/**
 * 处理关闭按钮点击
 */
const handleClose = () => {
  emit('close', props.notification.id);
};

/**
 * 处理通知点击（切换暂停/恢复）
 */
const handleClick = () => {
  // 如果有 onClick 回调，先执行
  if (props.notification.onClick) {
    props.notification.onClick();
  }

  // 切换暂停/恢复状态
  if (isPaused.value) {
    // 恢复自动关闭（从剩余时间继续）
    resumeNotification(props.notification.id);

    // 重新启动进度条（从剩余时间继续）
    if (props.notification.duration && props.notification.duration > 0 && remainingTime.value > 0) {
      progressTimer = window.setInterval(updateProgress, 100);
    }
  } else {
    // 暂停自动关闭
    pauseNotification(props.notification.id);

    // 清除进度条定时器
    if (progressTimer) {
      clearInterval(progressTimer);
      progressTimer = null;
    }
  }
};

/**
 * 更新进度条
 */
const updateProgress = () => {
  if (remainingTime.value > 0) {
    remainingTime.value -= 100;
  } else {
    // 时间到了，关闭通知
    handleClose();
  }
};

/**
 * 组件挂载时启动进度条更新
 */
onMounted(() => {
  if (props.notification.duration && props.notification.duration > 0 && !isPaused.value) {
    remainingTime.value = props.notification.duration;
    progressTimer = window.setInterval(updateProgress, 100);
  }
});

/**
 * 组件卸载时清理定时器
 */
onUnmounted(() => {
  if (progressTimer) {
    clearInterval(progressTimer);
    progressTimer = null;
  }
});
</script>

<template>
  <div
    :class="[
      'notification-toast',
      notification.type,
      { 'notification-clickable': notification.onClick },
      { 'notification-paused': isPaused }
    ]"
    @click="handleClick"
  >
    <div class="notification-content">
      <!-- 通知图标 -->
      <div :class="['notification-icon', notification.type]">
        <component :is="getIconComponent()" :size="18" stroke-width="2.5" />
      </div>

      <!-- 通知文本 -->
      <div class="notification-text">
        <div class="notification-title">{{ notification.title }}</div>
        <div v-if="notification.message" class="notification-message">
          <MarkdownRenderer
            v-if="notification.renderMarkdown"
            :content="notification.message"
          />
          <span v-else>{{ notification.message }}</span>
        </div>
      </div>

      <!-- 关闭按钮 -->
      <button class="notification-close" @click.stop="handleClose">
        <X :size="16" stroke-width="2" />
      </button>
    </div>

    <!-- 进度条 -->
    <Transition name="progress-fade">
      <div v-if="notification.duration && notification.duration > 0" class="notification-progress">
        <div
          class="notification-progress-bar"
          :class="{ 'paused': isPaused }"
          :style="{ width: progressWidth + '%' }"
        />
      </div>
    </Transition>
  </div>
</template>

<style scoped>
@import '../styles/notification.css';

/* 进度条淡入淡出动画 */
.progress-fade-enter-active,
.progress-fade-leave-active {
  transition: opacity 0.2s ease;
}

.progress-fade-enter-from,
.progress-fade-leave-to {
  opacity: 0;
}

/* ==================== 通知中的 Markdown 样式覆盖 ==================== */

/* Markdown 容器 */
.notification-message :deep(.markdown-renderer) {
  font-size: 13px;
  line-height: 1.4;
  color: var(--text-muted, #8E8E93);
}

/* 调整标题大小 */
.notification-message :deep(.markdown-renderer h1),
.notification-message :deep(.markdown-renderer h2),
.notification-message :deep(.markdown-renderer h3),
.notification-message :deep(.markdown-renderer h4),
.notification-message :deep(.markdown-renderer h5),
.notification-message :deep(.markdown-renderer h6) {
  margin-top: 0.5em;
  margin-bottom: 0.25em;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.3;
  border: none;
  padding: 0;
}

/* 调整段落 */
.notification-message :deep(.markdown-renderer p) {
  margin-top: 0;
  margin-bottom: 0.5em;
}

/* 调整粗体和斜体 */
.notification-message :deep(.markdown-renderer strong) {
  font-weight: 600;
  color: var(--text-main, #2D2D44);
}

.notification-message :deep(.markdown-renderer em) {
  font-style: italic;
}

/* 调整行内代码 */
.notification-message :deep(.markdown-renderer code) {
  font-size: 11px;
  padding: 0.15em 0.35em;
  border-radius: 3px;
  background: var(--accent-soft, rgba(157, 141, 241, 0.15));
}

/* 隐藏代码块（通知通常不需要显示大段代码） */
.notification-message :deep(.markdown-renderer pre) {
  display: none;
}

/* 调整列表 */
.notification-message :deep(.markdown-renderer ul),
.notification-message :deep(.markdown-renderer ol) {
  margin-top: 0;
  margin-bottom: 0.5em;
  padding-left: 1.5em;
}

.notification-message :deep(.markdown-renderer li) {
  margin-bottom: 0.15em;
}

/* 调整引用 */
.notification-message :deep(.markdown-renderer blockquote) {
  margin: 0.5em 0;
  padding: 0.3em 0.6em;
  border-left-width: 3px;
  border-radius: 4px;
  font-size: 12px;
}

/* 调整链接 */
.notification-message :deep(.markdown-renderer a) {
  color: var(--accent-purple, #9D8DF1);
}

/* 隐藏不需要的元素 */
.notification-message :deep(.markdown-renderer table),
.notification-message :deep(.markdown-renderer hr),
.notification-message :deep(.markdown-renderer img) {
  display: none;
}
</style>