import { computed, nextTick, ref, type Ref } from 'vue';
import type { Message } from '../types';

export function useChatViewport(messages: Ref<Message[]>, chatHistoryLimit: Ref<number>) {
  const messagesContainer = ref<HTMLElement>();
  const displayMessages = ref<Message[]>([]);
  const loadedCount = ref(0);

  const hasMoreMessages = computed(() => {
    return loadedCount.value < messages.value.length;
  });

  const loadMessages = () => {
    const limit = chatHistoryLimit.value;
    const totalCount = messages.value.length;

    if (totalCount <= limit) {
      displayMessages.value = [...messages.value];
      loadedCount.value = totalCount;
    } else {
      displayMessages.value = [...messages.value.slice(-limit)];
      loadedCount.value = limit;
    }
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

  const scrollToBottom = async () => {
    await nextTick();
    if (messagesContainer.value) {
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
    scrollToBottom,
  };
}
