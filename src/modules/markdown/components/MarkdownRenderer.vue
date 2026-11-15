<script setup lang="ts">
/**
 * Markdown 渲染器组件
 *
 * 轻量级包装组件，提供声明式 Markdown 渲染
 * 支持代码块一键复制功能
 */
import { computed, ref, watch, nextTick } from 'vue';
import { useMarkdown } from '../useMarkdown';
import { IncrementalMarkdownRenderer } from '../incremental';
import { useNotifications } from '../../notification/useNotifications';
import { getNotificationMessage } from '../../notification/messages';
import type { MarkdownRendererProps } from '../types';

/** 无 rAF 环境下的兼容间隔（约一帧） */
const STREAM_RENDER_FRAME_MS = 16;

const props = withDefaults(defineProps<MarkdownRendererProps>(), {
  enabled: true,
  streaming: false,
  config: () => ({}),
  class: '',
});

// 使用 composable
const { renderSafe } = useMarkdown(props.config);
const { showSuccess, showError } = useNotifications();

// 引用 DOM 元素
const containerRef = ref<HTMLElement>();
const debouncedContent = ref(props.content);
let frameHandle: number | null = null;
let frameTimer: ReturnType<typeof setTimeout> | null = null;

const cancelScheduledRender = () => {
  if (frameHandle !== null) {
    if (typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(frameHandle);
    }
    frameHandle = null;
  }

  if (frameTimer !== null) {
    clearTimeout(frameTimer);
    frameTimer = null;
  }
};

/** 立即把当前内容推到渲染层（定稿时用） */
const commitContent = () => {
  cancelScheduledRender();
  debouncedContent.value = props.content;
};

/**
 * 合帧调度：同一帧内的多次变化只渲染一次，且**不会无限推迟**。
 *
 * 早期这里是 80ms 的 debounce。流式时内容每 50ms 就变一次，每次变化都会重置
 * 定时器，于是定时器永远等不到「80ms 内没有新内容」的空闲——界面只在下一片
 * 数据迟迟不到时才刷新一次，肉眼看到的就是「一卡一卡」（不是算不过来，
 * 是根本画不出来）。合帧没有这个缺陷：最新内容最多等一帧就上屏。
 */
const scheduleRender = () => {
  if (frameHandle !== null || frameTimer !== null) {
    return;
  }

  if (typeof requestAnimationFrame === 'function') {
    frameHandle = requestAnimationFrame(() => {
      frameHandle = null;
      debouncedContent.value = props.content;
    });
    return;
  }

  frameTimer = setTimeout(() => {
    frameTimer = null;
    debouncedContent.value = props.content;
  }, STREAM_RENDER_FRAME_MS);
};

watch(
  () => props.content,
  () => {
    if (!props.streaming) {
      commitContent();
      return;
    }

    scheduleRender();
  },
  { immediate: true }
);

watch(
  () => props.streaming,
  (isStreaming) => {
    if (!isStreaming) {
      commitContent();
    }
  }
);

// 计算渲染结果
//
// 流式时走增量渲染：已完成的块按源文本缓存，只有新增块与末尾正在增长的块重渲；
// 定稿时走整篇渲染，把分块在跨块语法（如 loose list）上的近似差异收敛掉。
// 两者共用同一个 renderSafe，所以定稿结果与单次整篇渲染完全一致。
const incrementalRenderer = new IncrementalMarkdownRenderer((source) => renderSafe(source));

const renderedBlocks = computed(() => {
  const content = debouncedContent.value;
  if (!props.enabled || !content) {
    return [];
  }

  if (!props.streaming) {
    incrementalRenderer.reset();
    return [{ key: 0, html: renderSafe(content) }];
  }

  return incrementalRenderer.render(content).blocks;
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

// 监听块结构变化，重新添加复制按钮
//
// 不能直接 watch(renderedBlocks)：computed 每帧都返回新数组，而流式时尾部块
// 的内容每帧都在变。那样会每帧 nextTick + 遍历所有 pre code，而且 appendChild
// 又会反过来触发滚动跟随的 MutationObserver，形成无谓的连锁。
// 真正需要补按钮的时机只有「块结构变了」（新块出现到页面上）。
let lastBlockSignature = '';

watch(renderedBlocks, (blocks) => {
  const signature = blocks.map((block) => block.key).join('|');
  if (signature === lastBlockSignature) {
    return;
  }

  lastBlockSignature = signature;
  nextTick(() => {
    addCopyButtons();
  });
});

// 组件挂载后添加复制按钮
import { onMounted, onBeforeUnmount } from 'vue';
onMounted(() => {
  nextTick(() => {
    addCopyButtons();
  });
});

onBeforeUnmount(() => {
  cancelScheduledRender();
});
</script>

<template>
  <div
    v-if="props.enabled && props.content"
    ref="containerRef"
    class="markdown-renderer"
    :class="props.class"
  >
    <!-- 每块一个 v-html：前面的块 key 不变，Vue 不会重设它们的 innerHTML，
         于是流式过程中只有末尾块真正重建 DOM -->
    <div
      v-for="block in renderedBlocks"
      :key="block.key"
      class="md-block"
      v-html="block.html"
    />
  </div>
  <div v-else-if="props.content" class="markdown-renderer" :class="props.class">
    {{ props.content }}
  </div>
</template>

<style>
/* 块级容器
 *
 * display: contents 让这个包装元素在布局上不存在，于是后代选择器
 * （.markdown-renderer p / ul / pre …）的匹配结果与「内容直接挂在容器下」
 * 完全一致，样式与间距不会因为分包而改变。
 */
.markdown-renderer .md-block {
  display: contents;
}

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
