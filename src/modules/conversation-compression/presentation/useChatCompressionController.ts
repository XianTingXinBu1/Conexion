import type { Ref } from 'vue';
import type { ChatMessage, Conversation, Message } from '@/types';
import { getNotificationMessage } from '@/modules/notification/messages';
import { useConversationCompression } from './useConversationCompression';

interface UseChatCompressionControllerOptions {
  messages: Ref<Message[]>;
  currentConversation: Ref<Conversation | undefined>;
  canUseConversationCompression: Ref<boolean>;
  saveConversation: (messages: Message[], updates?: Partial<Conversation>) => Promise<void>;
  sendChatRequest: (messages: ChatMessage[]) => Promise<string>;
  showInfo: (title: string, message?: string) => void;
  showSuccess: (title: string, message?: string) => void;
  showError: (title: string, message?: string) => void;
}

export function useChatCompressionController(options: UseChatCompressionControllerOptions) {
  const compressionState = useConversationCompression({
    messages: options.messages,
    currentConversation: options.currentConversation,
    saveConversation: options.saveConversation,
    sendChatRequest: options.sendChatRequest,
  });

  const handleCompressConversation = async () => {
    if (compressionState.isCompressing.value) {
      return;
    }

    if (!options.canUseConversationCompression.value) {
      options.showInfo('暂不支持', '请先创建已保存会话后再压缩。');
      return;
    }

    if (!compressionState.canCompress.value) {
      options.showInfo('无需压缩', '当前会话可压缩的历史不足。');
      return;
    }

    try {
      const compressed = await compressionState.compressConversation({ keepRecentCount: 0 });
      if (!compressed) {
        options.showInfo('无需压缩', '当前会话可压缩的历史不足。');
        return;
      }

      const msg = getNotificationMessage('CHAT_COMPRESSION_SUCCESS');
      options.showSuccess(msg.title, msg.message);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '压缩失败';
      const msg = getNotificationMessage('CHAT_COMPRESSION_FAILED', { error: errorMessage });
      options.showError(msg.title, msg.message);
    }
  };

  return {
    ...compressionState,
    handleCompressConversation,
  };
}
