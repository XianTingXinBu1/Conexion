import { computed, ref, watch, type Ref } from 'vue';
import type { Conversation, ConversationCompression, Message } from '@/types';
import {
  buildCompressionSystemMessages,
  canCompressMessages,
  DEFAULT_COMPRESSION_KEEP_RECENT_MESSAGES,
  formatCompressionSummaryForPrompt,
  getEffectiveChatHistory,
  getEffectiveConversationTokenCount,
  splitMessagesForCompression,
} from '@/utils/conversationCompression';

interface UseConversationCompressionOptions {
  messages: Ref<Message[]>;
  currentConversation: Ref<Conversation | undefined>;
  saveConversation: (messages: Message[], updates?: Partial<Conversation>) => Promise<void>;
  sendChatRequest: (
    messages: Message[],
    systemPrompt?: string,
    systemMessages?: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  ) => Promise<string>;
}

export function useConversationCompression(options: UseConversationCompressionOptions) {
  const {
    messages,
    currentConversation,
    saveConversation,
    sendChatRequest,
  } = options;

  const compression = ref<ConversationCompression | undefined>(undefined);
  const isCompressing = ref(false);

  watch(
    () => currentConversation.value?.compression,
    (nextCompression) => {
      compression.value = nextCompression
        ? {
            ...nextCompression,
            sourceMessageIds: [...nextCompression.sourceMessageIds],
          }
        : undefined;
    },
    { immediate: true, deep: true },
  );

  const effectiveMessages = computed(() => getEffectiveChatHistory(messages.value, compression.value));
  const canCompress = computed(() => canCompressMessages(effectiveMessages.value));
  const compressionSummary = computed(() => compression.value?.summaryContent?.trim() || '');
  const compressionPromptContent = computed(() => compression.value?.promptContent?.trim() || '');

  const compressConversation = async (): Promise<boolean> => {
    if (isCompressing.value) {
      return false;
    }

    const activeMessages = effectiveMessages.value;
    const { compressibleMessages, retainedMessages, keepRecentCount } = splitMessagesForCompression(activeMessages);

    if (compressibleMessages.length === 0) {
      return false;
    }

    isCompressing.value = true;

    try {
      const contextBeforeCompression = getEffectiveConversationTokenCount(messages.value, compression.value);
      const summaryContent = (await sendChatRequest(
        compressibleMessages,
        undefined,
        buildCompressionSystemMessages(compression.value?.summaryContent),
      )).trim();

      if (!summaryContent) {
        throw new Error('压缩结果为空');
      }

      const sourceMessageIds = [
        ...(compression.value?.sourceMessageIds ?? []),
        ...compressibleMessages.map(message => message.id),
      ];
      const nextCompression: ConversationCompression = {
        compressedAt: Date.now(),
        summaryContent,
        promptContent: formatCompressionSummaryForPrompt(summaryContent),
        sourceMessageCount: sourceMessageIds.length,
        sourceMessageIds,
        keepRecentCount: Math.max(keepRecentCount, DEFAULT_COMPRESSION_KEEP_RECENT_MESSAGES),
        contextBeforeCompression,
      };
      nextCompression.contextAfterCompression = getEffectiveConversationTokenCount(
        [...compressibleMessages, ...retainedMessages],
        nextCompression,
      );

      compression.value = nextCompression;
      await saveConversation(messages.value, {
        compressed: true,
        compression: nextCompression,
      });

      return true;
    } finally {
      isCompressing.value = false;
    }
  };

  return {
    compression,
    compressionSummary,
    compressionPromptContent,
    effectiveMessages,
    canCompress,
    isCompressing,
    compressConversation,
  };
}
