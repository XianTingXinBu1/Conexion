import { ref, watch, nextTick, onUnmounted, type Ref } from 'vue';

const SCROLL_THRESHOLD = 24;

/** Follow output only while the reader stays at the bottom. No delayed forced scroll. */
export function useChatScrollPolicy(container: Ref<HTMLElement | undefined>) {
  const isNearBottom = ref(true);
  let frame: number | undefined;
  let mutations: MutationObserver | undefined;
  let resize: ResizeObserver | undefined;
  let attached: HTMLElement | undefined;
  let lastScrollTop = 0;

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
    if (!isNearBottom.value) return;
    nextTick(() => {
      if (frame !== undefined) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        frame = undefined;
        const el = container.value;
        // Recheck after rendering: the reader may have scrolled up in the meantime.
        if (el && isNearBottom.value) {
          el.scrollTop = el.scrollHeight;
          lastScrollTop = el.scrollTop;
        }
      });
    });
  };

  const detach = () => {
    attached?.removeEventListener('scroll', updateIsNearBottom);
    mutations?.disconnect();
    resize?.disconnect();
    if (frame !== undefined) cancelAnimationFrame(frame);
    frame = undefined;
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
