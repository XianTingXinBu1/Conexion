import { computed, nextTick, ref, type Ref } from 'vue';
import type { Message } from '../types';

export function useChatViewport(messages: Ref<Message[]>, chatHistoryLimit: Ref<number>) {
  const messagesContainer = ref<HTMLElement>();
  const displayMessages = ref<Message[]>([]);
  const loadedCount = ref(0);

  const hasMoreMessages = computed(() => {
    return loadedCount.value < messages.value.length;
  });

  const syncVisibleMessages = () => {
    const limit = chatHistoryLimit.value;
    const totalCount = messages.value.length;
    const nextLoadedCount = Math.min(totalCount, Math.max(loadedCount.value, limit));
    const nextDisplayMessages = totalCount <= nextLoadedCount
      ? messages.value
      : messages.value.slice(-nextLoadedCount);

    const sameLength = displayMessages.value.length === nextDisplayMessages.length;
    const sameIds = sameLength && displayMessages.value.every((message, index) => {
      const nextMessage = nextDisplayMessages[index];
      return nextMessage && message.id === nextMessage.id;
    });

    if (!sameIds) {
      displayMessages.value = [...nextDisplayMessages];
    }

    loadedCount.value = nextLoadedCount;
  };

  const loadMessages = () => {
    syncVisibleMessages();
  };

  const loadMoreMessages = () => {
    const limit = chatHistoryLimit.value;
    const remaining = messages.value.length - loadedCount.value;

    if (remaining <= 0) return;

    const countToLoad = Math.min(limit, remaining);
    const newMessages = messages.value.slice(
      messages.value.length - loadedCount.value - countToLoad,
      messages.value.length - loadedCount.value
    );

    const oldScrollTop = messagesContainer.value?.scrollTop || 0;
    const oldScrollHeight = messagesContainer.value?.scrollHeight || 0;

    displayMessages.value = [...newMessages, ...displayMessages.value];
    loadedCount.value += countToLoad;

    nextTick(() => {
      if (messagesContainer.value) {
        const newScrollHeight = messagesContainer.value.scrollHeight;
        messagesContainer.value.scrollTop = oldScrollTop + (newScrollHeight - oldScrollHeight);
      }
    });
  };

  const isNearBottom = (threshold = 24) => {
    if (!messagesContainer.value) {
      return true;
    }

    const { scrollTop, scrollHeight, clientHeight } = messagesContainer.value;
    return scrollHeight - (scrollTop + clientHeight) <= threshold;
  };

  const scrollToBottom = async (force = false) => {
    await nextTick();
    if (messagesContainer.value && (force || isNearBottom())) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
    }
  };

  return {
    messagesContainer,
    displayMessages,
    loadedCount,
    hasMoreMessages,
    loadMessages,
    loadMoreMessages,
    syncVisibleMessages,
    isNearBottom,
    scrollToBottom,
  };
}
