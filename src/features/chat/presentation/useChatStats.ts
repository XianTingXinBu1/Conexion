import { computed, type Ref } from 'vue';
import type { ChatMessage, Message, Preset } from '@/types';
import { countMessagesTokens } from '@/utils/tokenCounter';
import {
  getContextUsagePercent,
  isCompressionThresholdReached,
} from '@/modules/conversation-compression';

/**
 * 未加载预设（`currentApiPreset` 为空）时的兜底上下文窗口。
 *
 * 这里不引 `@/constants`：聊天展示层不允许依赖 constants/storage，边界检查会拦。
 * 正常情况下 `Preset.contextLength` 是必填的，只有预设尚未加载时才走这个兜底。
 */
const FALLBACK_CONTEXT_LENGTH = 2048;

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
    return currentApiPreset.value?.contextLength || FALLBACK_CONTEXT_LENGTH;
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
