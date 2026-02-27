<script setup lang="ts">
import { ref } from 'vue';
import { Copy, Check } from 'lucide-vue-next';
import { useNotifications, getNotificationMessage } from '../../notification';

interface Props {
  code: string;
  language?: string;
}

const props = withDefaults(defineProps<Props>(), {
  language: '',
});

const { showSuccess, showError } = useNotifications();
const isCopied = ref(false);
const isCopying = ref(false);

// 降级复制方法（使用 execCommand）
const fallbackCopyText = (text: string): boolean => {
  const textArea = document.createElement('textarea');
  textArea.value = text;

  // 使文本域在页面外不可见
  textArea.style.position = 'fixed';
  textArea.style.left = '-999999px';
  textArea.style.top = '-999999px';
  document.body.appendChild(textArea);

  try {
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    document.body.removeChild(textArea);
    return false;
  }
};

// 复制函数
const copyToClipboard = async (text: string): Promise<boolean> => {
  // 尝试使用现代 API
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      console.warn('Clipboard API 失败，尝试降级方案:', error);
    }
  }

  // 降级方案
  return fallbackCopyText(text);
};

const copyCode = async () => {
  if (isCopying.value) return;

  isCopying.value = true;

  const success = await copyToClipboard(props.code);

  if (success) {
    isCopied.value = true;

    // 显示成功通知
    const notificationMsg = getNotificationMessage('CODE_COPY_SUCCESS');
    showSuccess(notificationMsg.title, notificationMsg.message);

    // 2秒后恢复图标
    setTimeout(() => {
      isCopied.value = false;
    }, 2000);
  } else {
    // 显示错误通知
    const notificationMsg = getNotificationMessage('CODE_COPY_FAILED', {
      error: '复制失败，请手动选择复制',
    });
    showError(notificationMsg.title, notificationMsg.message);
  }

  isCopying.value = false;
};
</script>

<template>
  <div class="code-block-wrapper">
    <button
      class="copy-button"
      :class="{ 'copied': isCopied, 'copying': isCopying }"
      @click="copyCode"
      :title="isCopied ? '已复制' : '复制代码'"
    >
      <Check v-if="isCopied" :size="16" />
      <Copy v-else :size="16" />
    </button>
    <pre><code>{{ code }}</code></pre>
  </div>
</template>

<style scoped>
.code-block-wrapper {
  position: relative;
  margin: 1.2em 0;
  padding: 1em;
  border-radius: 12px;
  overflow-x: auto;
  border: 1px solid rgba(157, 141, 241, 0.3);
  background: linear-gradient(135deg, rgba(157, 141, 241, 0.08) 0%, rgba(183, 163, 227, 0.05) 100%);
  box-shadow: 0 2px 8px rgba(157, 141, 241, 0.1);
}

.copy-button {
  position: absolute;
  top: 0.5em;
  right: 0.5em;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  border: none;
  background: rgba(157, 141, 241, 0.2);
  color: var(--text-main);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  backdrop-filter: blur(4px);
}

.copy-button:hover {
  background: rgba(157, 141, 241, 0.4);
  transform: scale(1.05);
}

.copy-button:active {
  transform: scale(0.95);
}

.copy-button.copied {
  background: rgba(46, 160, 67, 0.3);
  color: #7ee787;
}

.copy-button.copying {
  opacity: 0.6;
  cursor: wait;
}

.code-block-wrapper pre {
  margin: 0;
  padding: 0;
  border: none;
  background: transparent;
  box-shadow: none;
}

.code-block-wrapper code {
  display: block;
  padding: 0;
  font-size: clamp(0.85em, 2vw, 0.95em);
  line-height: 1.7;
  font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', 'Monaco', 'Courier New', monospace;
  color: var(--text-main);
  white-space: pre;
}

/* 深色模式适配 */
[data-theme='dark'] .code-block-wrapper {
  background: linear-gradient(135deg, rgba(157, 141, 241, 0.12) 0%, rgba(183, 163, 227, 0.08) 100%);
  border-color: rgba(157, 141, 241, 0.4);
  box-shadow: 0 2px 12px rgba(157, 141, 241, 0.15);
}

[data-theme='dark'] .copy-button {
  background: rgba(157, 141, 241, 0.3);
}

[data-theme='dark'] .copy-button:hover {
  background: rgba(157, 141, 241, 0.5);
}

/* 小屏幕适配 */
@media (max-width: 640px) {
  .code-block-wrapper {
    padding: 0.8em;
  }

  .copy-button {
    top: 0.4em;
    right: 0.4em;
    width: 28px;
    height: 28px;
  }
}

/* 超小屏幕适配 */
@media (max-width: 480px) {
  .code-block-wrapper {
    padding: 0.6em;
  }

  .copy-button {
    top: 0.3em;
    right: 0.3em;
    width: 26px;
    height: 26px;
  }
}
</style>