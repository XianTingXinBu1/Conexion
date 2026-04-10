import { computed, type Ref } from 'vue';
import type { Message, Preset } from '../types';
import { countMessagesTokens } from '../utils/tokenCounter';

export function useChatStats(messages: Ref<Message[]>, currentApiPreset: Ref<Preset | undefined>) {
  const currentContextCount = computed(() => {
    try {
      const chatMessages = messages.value.map(msg => ({
        role: msg.type === 'user' ? 'user' : 'assistant',
        content: msg.content,
      }));
      return countMessagesTokens(chatMessages);
    } catch {
      return messages.value.length;
    }
  });

  const maxContextLength = computed(() => {
    return currentApiPreset.value?.maxTokens || 4096;
  });

  const userTokens = computed(() => {
    try {
      const userMessages = messages.value.filter(msg => msg.type === 'user');
      const chatMessages = userMessages.map(msg => ({
        role: 'user',
        content: msg.content,
      }));
      return countMessagesTokens(chatMessages);
    } catch {
      return 0;
    }
  });

  const aiTokens = computed(() => {
    try {
      const aiMessages = messages.value.filter(msg => msg.type === 'assistant');
      const chatMessages = aiMessages.map(msg => ({
        role: 'assistant',
        content: msg.content,
      }));
      return countMessagesTokens(chatMessages);
    } catch {
      return 0;
    }
  });

  const chatMessageCount = computed(() => messages.value.length);
  const userMessageCount = computed(() => messages.value.filter(m => m.type === 'user').length);
  const aiMessageCount = computed(() => messages.value.filter(m => m.type === 'assistant').length);

  return {
    currentContextCount,
    maxContextLength,
    userTokens,
    aiTokens,
    chatMessageCount,
    userMessageCount,
    aiMessageCount,
  };
}
