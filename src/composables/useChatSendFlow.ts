import { ref } from 'vue';
import type {
  AICharacter,
  ChatMessage,
  KnowledgeBase,
  Message,
  RegexRule,
  UserCharacter,
} from '@/types';
import { getNotificationMessage } from '../modules/notification';
import type { MergeMode } from '@/modules/system-prompt';
import type { Ref } from 'vue';
import { SendMessageUseCase } from '@/features/chat/application/sendMessage.usecase';
import {
  getEffectiveConversationTokenCount,
  isCompressionThresholdReached,
} from '@/modules/conversation-compression';

interface SendFlowStateDeps {
  messages: { value: Message[] };
  requestMessages: Ref<Message[]>;
  regexRules: Ref<RegexRule[]>;
  currentCharacter: { value: AICharacter | undefined };
  selectedUser: { value: UserCharacter | undefined };
  knowledgeBases: { value: KnowledgeBase[] };
  promptMergeMode: Ref<MergeMode>;
}

interface SendFlowCompressionDeps {
  mode: Ref<'manual' | 'auto'>;
  canUse: Ref<boolean>;
  thresholdReached: Ref<boolean>;
  thresholdPercent: Ref<number>;
  maxContextLength: Ref<number>;
  currentCompression: Ref<import('@/types').ConversationCompression | undefined>;
  compress: (options?: { keepRecentCount?: number }) => Promise<boolean>;
  isCompressing: Ref<boolean>;
  summary: Ref<string>;
}

interface SendFlowSessionDeps {
  persistedConversationId: { value: string | undefined };
  createNewConversation: (firstMessage: Message) => Promise<unknown>;
  saveConversation: () => Promise<void>;
}

interface SendFlowTransportDeps {
  resetUsage: () => void;
  loadRegexRules: () => Promise<void>;
  sendStreamChatRequest: (
    messages: ChatMessage[],
    onChunk: (chunk: string) => void,
    onComplete: () => void | Promise<void>,
    onError: (error: string) => void | Promise<void>,
  ) => Promise<void>;
  cancelRequest: () => void;
  buildSystemMessages: (context: {
    aiCharacter?: AICharacter;
    userCharacter?: UserCharacter;
    knowledgeBases: KnowledgeBase[];
    chatHistory: Message[];
    userInstruction: string;
    mergeMode: MergeMode;
    includeUserInstructionMessage?: boolean;
    compressionSummary?: string;
  }) => ChatMessage[];
}

interface SendFlowUiEffectsDeps {
  onStreamFlush: () => void;
  onMessageSend: () => void;
  showSuccess: (title: string, message?: string) => void;
  showError: (title: string, message?: string) => void;
}

interface SendFlowDeps {
  state: SendFlowStateDeps;
  compression: SendFlowCompressionDeps;
  session: SendFlowSessionDeps;
  transport: SendFlowTransportDeps;
  uiEffects: SendFlowUiEffectsDeps;
}

export function useChatSendFlow(deps: SendFlowDeps) {
  const isSending = ref(false);

  const handleCancelSend = () => {
    if (!isSending.value) {
      return;
    }

    deps.transport.cancelRequest();
  };

  const handleSendMessage = async (content: string) => {
    if (isSending.value || deps.compression.isCompressing.value) {
      return;
    }

    isSending.value = true;

    const useCase = new SendMessageUseCase({
      getMessages: () => deps.state.messages.value,
      getRequestMessages: () => deps.state.requestMessages.value,
      getRegexRules: () => deps.state.regexRules.value,
      getCurrentCharacter: () => deps.state.currentCharacter.value,
      getSelectedUser: () => deps.state.selectedUser.value,
      getKnowledgeBases: () => deps.state.knowledgeBases.value,
      getPromptMergeMode: () => deps.state.promptMergeMode.value,
      getCompressionMode: () => deps.compression.mode.value,
      canUseConversationCompression: () => deps.compression.canUse.value,
      isCompressionThresholdReached: (messages) => {
        if (!messages) {
          return deps.compression.thresholdReached.value;
        }

        return isCompressionThresholdReached(
          getEffectiveConversationTokenCount(messages, deps.compression.currentCompression.value),
          deps.compression.maxContextLength.value,
          deps.compression.thresholdPercent.value,
        );
      },
      compressConversation: deps.compression.compress,
      getCompressionSummary: () => deps.compression.summary.value,
      getPersistedConversationId: () => deps.session.persistedConversationId.value,
      resetUsage: deps.transport.resetUsage,
      loadRegexRules: deps.transport.loadRegexRules,
      createNewConversation: deps.session.createNewConversation,
      saveConversation: deps.session.saveConversation,
      onStreamFlush: deps.uiEffects.onStreamFlush,
      onMessageSend: deps.uiEffects.onMessageSend,
      sendStreamChatRequest: deps.transport.sendStreamChatRequest,
      buildSystemMessages: deps.transport.buildSystemMessages,
      onSuccess: (kind) => {
        const notificationMsg = getNotificationMessage(
          kind === 'compression' ? 'CHAT_COMPRESSION_SUCCESS' : 'CHAT_SEND_SUCCESS'
        );
        deps.uiEffects.showSuccess(notificationMsg.title, notificationMsg.message);
      },
      onError: (kind, error) => {
        const notificationMsg = getNotificationMessage(
          kind === 'compression' ? 'CHAT_COMPRESSION_FAILED' : 'CHAT_SEND_FAILED',
          { error },
        );
        deps.uiEffects.showError(notificationMsg.title, notificationMsg.message);
      },
    });

    try {
      await useCase.execute(content);
    } finally {
      isSending.value = false;
    }
  };

  return {
    isSending,
    handleSendMessage,
    handleCancelSend,
  };
}
