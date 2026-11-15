import { ref, watch, nextTick, onUnmounted, type Ref } from 'vue';

const SCROLL_THRESHOLD = 24;

/** Follow output only while the reader stays at the bottom. No delayed forced scroll. */
export function useChatScrollPolicy(container: Ref<HTMLElement | undefined>) {
  const isNearBottom = ref(true);
  let mutations: MutationObserver | undefined;
  let resize: ResizeObserver | undefined;
  let attached: HTMLElement | undefined;
  let lastScrollTop = 0;
  let pendingScroll = false;

  const updateIsNearBottom = () => {
    const el = container.value;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= SCROLL_THRESHOLD;
    // A delayed scroll event after content growth must not disable following.
    if (atBottom) isNearBottom.value = true;
    else if (lastScrollTop - el.scrollTop > SCROLL_THRESHOLD) isNearBottom.value = false;
    // Keep the high-water mark so several small upward steps also stop following.
    if (atBottom || !isNearBottom.value || el.scrollTop > lastScrollTop) lastScrollTop = el.scrollTop;
  };

  const scrollToBottom = () => {
    // 必须在 DOM 更新后的**同一个帧内**设 scrollTop。
    // 早期这里是 nextTick + requestAnimationFrame：DOM 在帧 N 更新，scrollTop 却到
    // 帧 N+1 才设。中间那一帧浏览器已经按旧 scrollTop 把增长的内容画出来了，
    // 表现为消息内容和下方按钮先往上跑、再被拉回底部——流式输出时的「上下跳」。
    // nextTick 是微任务，在 DOM 更新后、浏览器绘制前执行，设完立即反映在同一帧。
    // 加待滚动标记避免一帧内被 MutationObserver / ResizeObserver 多次触发。
    if (!isNearBottom.value || pendingScroll) return;
    pendingScroll = true;

    nextTick(() => {
      pendingScroll = false;
      const el = container.value;
      // Recheck after rendering: the reader may have scrolled up in the meantime.
      if (!el || !isNearBottom.value) return;

      el.scrollTop = el.scrollHeight;
      lastScrollTop = el.scrollTop;
    });
  };

  const detach = () => {
    attached?.removeEventListener('scroll', updateIsNearBottom);
    mutations?.disconnect();
    resize?.disconnect();
    pendingScroll = false;
  };

  watch(container, (el) => {
    detach();
    attached = el;
    if (!el) return;
    lastScrollTop = el.scrollTop;
    el.addEventListener('scroll', updateIsNearBottom, { passive: true });
    mutations = new MutationObserver(scrollToBottom);
    mutations.observe(el, { childList: true, subtree: true, characterData: true });
    resize = new ResizeObserver(scrollToBottom);
    resize.observe(el);
  }, { immediate: true });

  onUnmounted(detach);

  return {
    isNearBottom,
    scrollToBottom,
    onStreamFlush: scrollToBottom,
    onInputFocus: scrollToBottom,
    onMessageSend: scrollToBottom,
    onPageLoad: scrollToBottom,
  };
}
