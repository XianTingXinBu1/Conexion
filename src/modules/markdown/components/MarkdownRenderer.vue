<script setup lang="ts">
/**
 * Markdown 渲染器组件
 *
 * 轻量级包装组件，提供声明式 Markdown 渲染
 * 支持代码块一键复制功能
 */
import { computed, ref, watch, nextTick } from 'vue';
import { useMarkdown } from '../useMarkdown';
import { useNotifications, getNotificationMessage } from '../../notification';
import type { MarkdownRendererProps } from '../types';

const props = withDefaults(defineProps<MarkdownRendererProps>(), {
  enabled: true,
  config: () => ({}),
  class: '',
});

// 使用 composable
const { renderSafe } = useMarkdown(props.config);
const { showSuccess, showError } = useNotifications();

// 引用 DOM 元素
const containerRef = ref<HTMLElement>();

// 计算渲染结果
const renderedHtml = computed(() => {
  if (!props.enabled || !props.content) {
    return '';
  }
  return renderSafe(props.content);
});

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

// 更新按钮状态为成功
const setButtonSuccess = (button: HTMLButtonElement) => {
  button.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7ee787" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
  `;
  button.classList.add('copied');

  setTimeout(() => {
    button.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
      </svg>
    `;
    button.classList.remove('copied');
  }, 2000);
};

// 添加复制按钮到代码块
const addCopyButtons = () => {
  if (!containerRef.value) return;

  const codeBlocks = containerRef.value.querySelectorAll('pre code');

  codeBlocks.forEach((codeBlock) => {
    // 找到 pre 元素（可能是直接父元素或通过 code-wrapper）
    const pre = codeBlock.closest('pre');
    if (!pre) return;

    // 检查是否已经有复制按钮
    if (pre.querySelector('.copy-button')) return;

    // 创建复制按钮
    const button = document.createElement('button');
    button.className = 'copy-button';
    button.title = '复制代码';
    button.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
      </svg>
    `;

    // 添加点击事件
    button.addEventListener('click', async () => {
      const code = codeBlock.textContent || '';
      const success = await copyToClipboard(code);

      if (success) {
        setButtonSuccess(button);
        const notificationMsg = getNotificationMessage('CODE_COPY_SUCCESS');
        showSuccess(notificationMsg.title, notificationMsg.message);
      } else {
        const notificationMsg = getNotificationMessage('CODE_COPY_FAILED', {
          error: '复制失败，请手动选择复制',
        });
        showError(notificationMsg.title, notificationMsg.message);
      }
    });

    // 添加按钮到 pre 元素
    pre.style.position = 'relative';
    pre.appendChild(button);
  });
};

// 监听内容变化，重新添加复制按钮
watch(renderedHtml, () => {
  nextTick(() => {
    addCopyButtons();
  });
});

// 组件挂载后添加复制按钮
import { onMounted } from 'vue';
onMounted(() => {
  nextTick(() => {
    addCopyButtons();
  });
});
</script>

<template>
  <div
    v-if="props.enabled && props.content"
    ref="containerRef"
    class="markdown-renderer"
    :class="props.class"
    v-html="renderedHtml"
  />
  <div v-else-if="props.content" class="markdown-renderer" :class="props.class">
    {{ props.content }}
  </div>
</template>

<style>
/* 代码块复制按钮样式 */
.markdown-renderer pre {
  position: relative;
}

.markdown-renderer .copy-button {
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
  padding: 6px;
  z-index: 20;
  flex-shrink: 0;
}

.markdown-renderer .copy-button:hover {
  background: rgba(157, 141, 241, 0.4);
  transform: scale(1.05);
}

.markdown-renderer .copy-button:active {
  transform: scale(0.95);
}

.markdown-renderer .copy-button.copied {
  background: rgba(46, 160, 67, 0.3);
}

/* 深色模式适配 */
[data-theme='dark'] .markdown-renderer .copy-button {
  background: rgba(157, 141, 241, 0.3);
}

[data-theme='dark'] .markdown-renderer .copy-button:hover {
  background: rgba(157, 141, 241, 0.5);
}

/* 小屏幕适配 */
@media (max-width: 640px) {
  .markdown-renderer .copy-button {
    top: 0.4em;
    right: 0.4em;
    width: 28px;
    height: 28px;
  }
}

/* 超小屏幕适配 */
@media (max-width: 480px) {
  .markdown-renderer .copy-button {
    top: 0.3em;
    right: 0.3em;
    width: 26px;
    height: 26px;
  }
}
</style>
