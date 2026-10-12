import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useChatApi } from './useChatApi';
import { useConfirmDialog } from '@/composables/useConfirmDialog';
import { useCharacters } from '@/composables/useCharacters';
import { useKnowledgeBases } from '@/composables/useKnowledgeBases';
import { useApiPresets } from '@/modules/api-preset';
import { useNotifications, getNotificationMessage } from '@/modules/notification';
import { useAppSettings } from '@/composables/useAppSettings';
import { useTheme } from '@/composables/useTheme';
import { useChatStats } from './useChatStats';
import { useChatViewport } from './useChatViewport';
import { useChatScrollPolicy } from './useChatScrollPolicy';
import { useChatMessageActions } from './useChatMessageActions';
import { useChatSendFlow } from './useChatSendFlow';
import { useChatSessionMeta } from './useChatSessionMeta';
import { useChatSessionFacade } from './useChatSessionFacade';
import { useChatCompressionController } from '@/modules/conversation-compression/presentation';
import { useChatPromptController } from './useChatPromptController';
import { useChatLifecycleController } from './useChatLifecycleController';
import { buildGreetingMessage } from '../application/buildGreetingMessage.usecase';
import type { ChatPageProps } from './chatPageTypes';

export function useChatPageViewModel(props: ChatPageProps) {
  const {
    enterToSend,
    showWordCount,
    enableMarkdown,
    showMessageIndex,
    chatHistoryLimit,
    promptMergeMode,
    compressionThresholdPercent,
    compressionMode,
  } = useAppSettings();
  const { theme } = useTheme();

  const router = useRouter();
  const session = useChatSessionFacade(props);
  const {
    currentCharacter,
    messages,
    currentConversation,
    persistedConversationId,
    canUseConversationCompression,
    loadAICharacter,
    loadConversation,
    createNewConversation,
    saveConversation,
    editMessage,
    deleteMessage,
  } = session;

  const {
    confirmDialogProps,
    showDeleteConfirm: showDeleteConfirmDialog,
    confirmDelete: confirmDeleteMessage,
    cancelDelete,
    ConfirmDialog: ConfirmDialogComponent,
  } = useConfirmDialog();

  const { chatTitle, chatSubtitle } = useChatSessionMeta({
    currentCharacter,
    currentConversation,
  });

  const {
    sendStreamChatRequest,
    cancelRequest,
    usage,
    contextTokenBaseline,
    responseMetrics,
    resetUsage,
    requestStatus,
    isRequestActive,
  } = useChatApi();
  const compressionApi = useChatApi();
  const { showSuccess, showError, showInfo, showWarning } = useNotifications();
  const { selectedUser, init: initCharacters } = useCharacters();
  const { knowledgeBases, init: initKnowledgeBases } = useKnowledgeBases();
  const { currentPreset: currentApiPreset, loadPresets: loadApiPresets } = useApiPresets();
  const apiPresetsReady = ref(false);

  const {
    compression,
    compressionSummary,
    compressionPromptContent,
    effectiveMessages,
    canCompress,
    isCompressing,
    compressConversation,
    handleCompressConversation,
  } = useChatCompressionController({
    messages,
    currentConversation,
    canUseConversationCompression,
    saveConversation,
    sendChatRequest: compressionApi.sendChatRequest,
    showInfo,
    showSuccess,
    showError,
  });

  const chatViewport = useChatViewport(effectiveMessages, chatHistoryLimit);
  const {
    displayMessages,
    loadedCount,
    hasMoreMessages,
    loadMessages,
    loadMoreMessages,
    syncVisibleMessages,
  } = chatViewport;

  const scrollPolicy = useChatScrollPolicy(chatViewport.messagesContainer);

  const {
    currentPromptPreset,
    lastSystemPromptResult,
    lastSystemMessages,
    showPromptPreview,
    loadPromptPresets,
    buildSystemMessages,
    showTokenDetails,
    closeTokenDetails,
    toggleTokenDetails,
    openPromptAssistant,
  } = useChatPromptController({
    currentCharacter,
    selectedUser,
    knowledgeBases,
    effectiveMessages,
    promptMergeMode,
    compressionPromptContent,
  });

  const currentContextMessages = computed(() => buildSystemMessages({
    aiCharacter: currentCharacter.value,
    userCharacter: selectedUser.value,
    knowledgeBases: knowledgeBases.value,
    chatHistory: effectiveMessages.value,
    userInstruction: '',
    mergeMode: promptMergeMode.value,
    includeUserInstructionMessage: false,
    compressionSummary: compressionPromptContent.value,
  }));

  const {
    currentContextCount,
    contextTokenSourceLabel,
    resolveTokens,
    maxContextLength,
    userTokens,
    aiTokens,
    chatMessageCount,
    userMessageCount,
    aiMessageCount,
    usagePercent,
    isCompressionThresholdReached,
  } = useChatStats(effectiveMessages, currentContextMessages, currentApiPreset, compressionThresholdPercent, apiPresetsReady, contextTokenBaseline);

  /**
   * 跨过上下文阈值时用全局通知提醒一次。
   *
   * 以前是页面里常驻一条「可压缩历史上下文」提示条，不带阈值要求、
   * 只要有消息就显示，太吵；改成只在跨过阈值的那一刻提醒，
   * 压缩入口保留在上下文详情面板里（那里有常驻的手动压缩按钮）。
   */
  watch(isCompressionThresholdReached, (reached) => {
    if (!reached) return;
    // 自动模式会自行压缩，压缩完成后另有成功通知
    if (compressionMode.value !== 'manual') return;
    // 临时会话不支持压缩
    if (!canUseConversationCompression.value) return;
    // 没有可压缩的历史（例如刚压缩完）
    if (!canCompress.value) return;

    const msg = getNotificationMessage('CHAT_COMPRESSION_THRESHOLD_REACHED', {
      usage: usagePercent.value,
      threshold: compressionThresholdPercent.value,
      tokens: currentContextCount.value.toLocaleString(),
      limit: maxContextLength.value.toLocaleString(),
      source: contextTokenSourceLabel.value,
    });
    showWarning(msg.title, msg.message);
  });

  const { regexRules, loadRegexRules } = useChatLifecycleController({
    props,
    effectiveMessages,
    currentCharacter,
    chatHistoryLimit,
    onPageLoad: scrollPolicy.onPageLoad,
    loadAICharacter,
    loadConversation,
    syncVisibleMessages,
    loadPromptPresets,
    loadApiPresets: async () => {
      await loadApiPresets();
      apiPresetsReady.value = true;
    },
    initCharacters,
    initKnowledgeBases,
    loadMessages,
    seedGreeting: async (character, rules) => {
      // 只在全新角色会话里灌；已有消息（历史会话、临时会话）不动
      if (messages.value.length > 0) return;

      const greeting = buildGreetingMessage({
        character,
        userCharacter: selectedUser.value,
        rules,
        now: new Date(),
      });

      if (greeting) {
        messages.value.push(greeting);
      }
    },
  });

  const {
    isSending,
    handleSendMessage,
    handleCancelSend,
  } = useChatSendFlow({
    state: {
      messages,
      requestMessages: effectiveMessages,
      regexRules,
      currentCharacter,
      selectedUser,
      knowledgeBases,
      promptMergeMode,
    },
    compression: {
      mode: compressionMode,
      canUse: canUseConversationCompression,
      thresholdReached: isCompressionThresholdReached,
      thresholdPercent: compressionThresholdPercent,
      maxContextLength,
      currentCompression: compression,
      compress: compressConversation,
      isCompressing,
      summary: compressionPromptContent,
    },
    session: {
      persistedConversationId,
      createNewConversation,
      saveConversation: () => saveConversation(),
    },
    transport: {
      resetUsage,
      loadRegexRules,
      sendStreamChatRequest,
      cancelRequest: () => { cancelRequest(); compressionApi.cancelRequest(); },
      buildSystemMessages,
      resolveContextTokens: resolveTokens,
    },
    uiEffects: {
      onStreamFlush: scrollPolicy.onStreamFlush,
      onMessageSend: scrollPolicy.onMessageSend,
      showSuccess,
      showError,
    },
  });

  const {
    showEditModal,
    editingMessageId,
    editingMessageContent,
    handleEditMessage,
    handleSaveEdit,
    handleDeleteMessage,
    confirmDelete,
  } = useChatMessageActions({
    messages,
    editMessage,
    deleteMessage,
    showDeleteConfirmDialog,
    confirmDeleteMessage,
    showSuccess,
    showError,
  });

  return {
    router,
    enterToSend,
    showWordCount,
    enableMarkdown,
    showMessageIndex,
    compressionThresholdPercent,
    compressionMode,
    theme,
    chatTitle,
    chatSubtitle,
    compressionSummary,
    canUseConversationCompression,
    usagePercent,
    isCompressionThresholdReached,
    isCompressing,
    currentContextCount,
    contextTokenSourceLabel,
    compressionUsage: compressionApi.usage,
    maxContextLength,
    userTokens,
    aiTokens,
    chatMessageCount,
    userMessageCount,
    aiMessageCount,
    displayMessages,
    loadedCount,
    hasMoreMessages,
    loadMoreMessages,
    chatViewport,
    showTokenDetails,
    closeTokenDetails,
    toggleTokenDetails,
    handleCompressConversation,
    canCompress,
    currentApiPreset,
    currentPromptPreset,
    usage,
    contextTokenBaseline,
    responseMetrics,
    isSending,
    isRequestActive,
    requestStatus,
    handleSendMessage,
    handleCancelSend,
    openPromptAssistant,
    showEditModal,
    editingMessageId,
    editingMessageContent,
    handleEditMessage,
    handleSaveEdit,
    showPromptPreview,
    lastSystemMessages,
    lastSystemPromptResult,
    handleDeleteMessage,
    ConfirmDialogComponent,
    confirmDialogProps,
    confirmDelete,
    cancelDelete,
    scrollPolicy,
  };
}
