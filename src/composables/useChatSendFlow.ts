import { ref } from 'vue';
import type {
  AICharacter,
  ChatMessage,
  KnowledgeBase,
  Message,
  RegexRule,
  UserCharacter,
} from '../types';
import type { MergeMode } from '../modules/system-prompt';
import type { Ref } from 'vue';
import { applyRules } from '../utils/regexEngine';
import { getNotificationMessage } from '../modules/notification';

interface SendFlowDeps {
  messages: { value: Message[] };
  regexRules: Ref<RegexRule[]>;
  currentCharacter: { value: AICharacter | undefined };
  selectedUser: { value: UserCharacter | undefined };
  knowledgeBases: { value: KnowledgeBase[] };
  promptMergeMode: Ref<MergeMode>;
  persistedConversationId: { value: string | undefined };
  resetUsage: () => void;
  loadRegexRules: () => Promise<void>;
  createNewConversation: (firstMessage: Message) => Promise<unknown>;
  saveConversation: () => Promise<void>;
  scrollToBottom: (force?: boolean) => Promise<void> | void;
  sendStreamChatRequest: (
    messages: Message[],
    onChunk: (chunk: string) => void,
    onComplete: () => void,
    onError: (error: string) => void,
    systemPrompt?: string,
    systemMessages?: ChatMessage[]
  ) => Promise<void>;
  cancelRequest: () => void;
  buildSystemMessages: (context: {
    aiCharacter?: AICharacter;
    userCharacter?: UserCharacter;
    knowledgeBases: KnowledgeBase[];
    chatHistory: Message[];
    userInstruction: string;
    mergeMode: MergeMode;
  }) => ChatMessage[];
  showSuccess: (title: string, message?: string) => void;
  showError: (title: string, message?: string) => void;
}

export function useChatSendFlow(deps: SendFlowDeps) {
  const shouldAutoScrollOnStream = ref(true);
  const STREAM_FLUSH_INTERVAL_MS = 50;
  const isSending = ref(false);

  const handleCancelSend = () => {
    if (!isSending.value) {
      return;
    }

    deps.cancelRequest();
  };

  const handleSendMessage = async (content: string) => {
    if (isSending.value) {
      return;
    }

    deps.resetUsage();
    await deps.loadRegexRules();

    const processedContent = applyRules(content, 'user', 'after-macro', deps.regexRules.value);

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: processedContent,
      timestamp: Date.now(),
    };

    const chatHistoryBeforeSend = [...deps.messages.value];
    deps.messages.value.push(userMessage);

    if (!deps.persistedConversationId.value) {
      await deps.createNewConversation(userMessage);
    } else {
      await deps.saveConversation();
    }

    await deps.scrollToBottom(true);

    const assistantMessageId = (Date.now() + 1).toString();
    const assistantMessage: Message = {
      id: assistantMessageId,
      type: 'assistant',
      content: '',
      timestamp: Date.now(),
    };
    deps.messages.value.push(assistantMessage);
    shouldAutoScrollOnStream.value = true;
    isSending.value = true;

    const systemMessages = deps.buildSystemMessages({
      aiCharacter: deps.currentCharacter.value,
      userCharacter: deps.selectedUser.value,
      knowledgeBases: deps.knowledgeBases.value,
      chatHistory: chatHistoryBeforeSend,
      userInstruction: processedContent,
      mergeMode: deps.promptMergeMode.value,
    });

    let streamBuffer = '';
    let flushTimer: ReturnType<typeof setTimeout> | null = null;
    let isCancelled = false;
    let hasCompleted = false;

    const flushBufferedContent = () => {
      if (!streamBuffer) return;

      const msg = deps.messages.value.find(m => m.id === assistantMessageId);
      if (!msg) {
        streamBuffer = '';
        return;
      }

      msg.content = applyRules(
        msg.content + streamBuffer,
        'assistant',
        'after-macro',
        deps.regexRules.value
      );
      streamBuffer = '';

      if (shouldAutoScrollOnStream.value) {
        deps.scrollToBottom();
      }
    };

    const clearFlushTimer = () => {
      if (!flushTimer) return;
      clearTimeout(flushTimer);
      flushTimer = null;
    };

    const scheduleFlush = () => {
      if (flushTimer) return;
      flushTimer = setTimeout(() => {
        flushTimer = null;
        flushBufferedContent();
      }, STREAM_FLUSH_INTERVAL_MS);
    };

    const finalizeSend = async () => {
      clearFlushTimer();
      flushBufferedContent();
      isSending.value = false;
      await deps.saveConversation();
    };

    try {
      await deps.sendStreamChatRequest(
        chatHistoryBeforeSend,
        (chunk: string) => {
          streamBuffer += chunk;
          scheduleFlush();
        },
        async () => {
          hasCompleted = true;
          await finalizeSend();

          const msg = deps.messages.value.find(m => m.id === assistantMessageId);
          if (!msg) return;

          msg.content = applyRules(msg.content, 'assistant', 'after-macro', deps.regexRules.value);
          const notificationMsg = getNotificationMessage('CHAT_SEND_SUCCESS');
          deps.showSuccess(notificationMsg.title, notificationMsg.message);
        },
        async (error: string) => {
          isCancelled = error === '请求已取消';
          await finalizeSend();

          const msg = deps.messages.value.find(m => m.id === assistantMessageId);
          if (!msg) return;

          if (isCancelled) {
            if (!msg.content.trim()) {
              msg.content = '已停止生成';
            }
            return;
          }

          msg.content = `错误: ${error}`;
          const notificationMsg = getNotificationMessage('CHAT_SEND_FAILED', { error });
          deps.showError(notificationMsg.title, notificationMsg.message);
        },
        undefined,
        systemMessages.length > 0 ? systemMessages : undefined
      );
    } catch (err) {
      if (hasCompleted || isCancelled) {
        return;
      }

      clearFlushTimer();
      streamBuffer = '';
      isSending.value = false;
      const msg = deps.messages.value.find(m => m.id === assistantMessageId);
      if (!msg) return;

      const errorMessage = err instanceof Error ? err.message : '发送失败';
      if (errorMessage === '请求已取消') {
        if (!msg.content.trim()) {
          msg.content = '已停止生成';
        }
        await deps.saveConversation();
        return;
      }

      msg.content = `错误: ${errorMessage}`;
      await deps.saveConversation();
      const notificationMsg = getNotificationMessage('CHAT_SEND_FAILED', { error: errorMessage });
      deps.showError(notificationMsg.title, notificationMsg.message);
    }
  };

  return {
    shouldAutoScrollOnStream,
    isSending,
    handleSendMessage,
    handleCancelSend,
  };
}
