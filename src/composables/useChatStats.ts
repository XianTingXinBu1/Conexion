import { computed, type Ref } from 'vue';
import type { ChatMessage, Message, Preset } from '@/types';
import { countMessagesTokens } from '../utils/tokenCounter';
import {
  getContextUsagePercent,
  isCompressionThresholdReached,
} from '@/modules/conversation-compression';

const countByType = (messages: Message[], type: Message['type']) => {
  let count = 0;

  for (const message of messages) {
    if (message.type === type) count += 1;
  }

  return count;
};

const countTokensByRole = (messages: Message[], type: Message['type']) => {
  return countMessagesTokens(
    messages
      .filter(message => message.type === type)
      .map(message => ({
        role: message.type === 'assistant' ? 'assistant' : 'user',
        content: message.content,
      })),
  );
};

export function useChatStats(
  visibleMessages: Ref<Message[]>,
  currentRequestMessages: Ref<ChatMessage[]>,
  currentApiPreset: Ref<Preset | undefined>,
  compressionThresholdPercent: Ref<number>,
) {
  const currentContextCount = computed(() => countMessagesTokens(currentRequestMessages.value));

  const maxContextLength = computed(() => {
    return currentApiPreset.value?.contextLength || currentApiPreset.value?.maxTokens || 4096;
  });

  const userTokens = computed(() => countTokensByRole(visibleMessages.value, 'user'));
  const aiTokens = computed(() => countTokensByRole(visibleMessages.value, 'assistant'));
  const usagePercent = computed(() => getContextUsagePercent(currentContextCount.value, maxContextLength.value));
  const isCompressionThresholdReachedValue = computed(() => isCompressionThresholdReached(
    currentContextCount.value,
    maxContextLength.value,
    compressionThresholdPercent.value,
  ));

  const chatMessageCount = computed(() => visibleMessages.value.length);
  const userMessageCount = computed(() => countByType(visibleMessages.value, 'user'));
  const aiMessageCount = computed(() => countByType(visibleMessages.value, 'assistant'));

  return {
    currentContextCount,
    maxContextLength,
    userTokens,
    aiTokens,
    chatMessageCount,
    userMessageCount,
    aiMessageCount,
    usagePercent,
    isCompressionThresholdReached: isCompressionThresholdReachedValue,
  };
}
