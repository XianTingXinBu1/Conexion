import { ref, watch, onUnmounted, type Ref } from 'vue';

const SCROLL_THRESHOLD = 24;

/**
 * 统一滚动策略
 *
 * 集中管理"什么时候该滚动到底部"的所有决策逻辑：
 * - 监听容器 scroll 事件，实时追踪用户是否在底部
 * - 流式输出时：用户在底部才跟随
 * - 输入框聚焦、发送消息、页面加载时：强制到底
 */
export function useChatScrollPolicy(container: Ref<HTMLElement | undefined>) {
  const isNearBottom = ref(true);

  // ---- 追踪用户是否在底部 ----

  const updateIsNearBottom = () => {
    const el = container.value;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    isNearBottom.value = scrollHeight - (scrollTop + clientHeight) <= SCROLL_THRESHOLD;
  };

  watch(container, (el, oldEl) => {
    if (oldEl) {
      oldEl.removeEventListener('scroll', updateIsNearBottom);
    }
    if (el) {
      el.addEventListener('scroll', updateIsNearBottom, { passive: true });
    }
  }, { immediate: true });

  onUnmounted(() => {
    if (container.value) {
      container.value.removeEventListener('scroll', updateIsNearBottom);
    }
  });

  // ---- 滚动动作 ----

  const scrollToBottom = (force = false) => {
    const tryScroll = () => {
      const el = container.value;
      if (!el) return;
      if (force || isNearBottom.value) {
        el.scrollTop = el.scrollHeight;
      }
    };

    // 立即 + rAF 尝试
    tryScroll();
    requestAnimationFrame(tryScroll);

    // ResizeObserver：消息容器尺寸变化（键盘弹出/收回）时重新滚动到底
    // 相比 setTimeout 猜时机 / visualViewport 依赖窗口事件，这更精准
    const el = container.value;
    if (el) {
      const observer = new ResizeObserver(() => tryScroll());
      observer.observe(el);
      setTimeout(() => observer.disconnect(), 1500);
    }
  };

  // ---- 策略方法 ----

  /** 流式输出刷新时：用户在底部才跟随 */
  const onStreamFlush = () => scrollToBottom(false);

  /** 输入框聚焦时：强制到底 */
  const onInputFocus = () => scrollToBottom(true);

  /** 发送消息时：强制到底 */
  const onMessageSend = () => scrollToBottom(true);

  /** 页面加载时：强制到底 */
  const onPageLoad = () => scrollToBottom(true);

  return {
    isNearBottom,
    scrollToBottom,
    onStreamFlush,
    onInputFocus,
    onMessageSend,
    onPageLoad,
  };
}