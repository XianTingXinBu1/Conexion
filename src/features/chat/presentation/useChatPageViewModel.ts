import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useChatApi } from '@/composables/useChatApi';
import { useConfirmDialog } from '@/composables/useConfirmDialog';
import { useCharacters } from '@/composables/useCharacters';
import { useKnowledgeBases } from '@/composables/useKnowledgeBases';
import { useApiPresets } from '@/modules/api-preset';
import { useNotifications } from '@/modules/notification';
import { useAppSettings } from '@/composables/useAppSettings';
import { useTheme } from '@/composables/useTheme';
import { useChatStats } from '@/composables/useChatStats';
import { useChatViewport } from '@/composables/useChatViewport';
import { useChatScrollPolicy } from '@/composables/useChatScrollPolicy';
import { useChatMessageActions } from '@/composables/useChatMessageActions';
import { useChatSendFlow } from '@/composables/useChatSendFlow';
import { useChatSessionMeta } from '@/composables/useChatSessionMeta';
import { useChatSessionFacade } from './useChatSessionFacade';
import { useChatCompressionController } from '@/modules/conversation-compression/presentation';
import { useChatPromptController } from './useChatPromptController';
import { useChatLifecycleController } from './useChatLifecycleController';
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
    sendChatRequest,
    sendStreamChatRequest,
    cancelRequest,
    usage,
    responseMetrics,
    resetUsage,
    requestStatus,
    isRequestActive,
  } = useChatApi();
  const { showSuccess, showError, showInfo } = useNotifications();
  const { selectedUser, init: initCharacters } = useCharacters();
  const { knowledgeBases, init: initKnowledgeBases } = useKnowledgeBases();
  const { currentPreset: currentApiPreset, loadPresets: loadApiPresets } = useApiPresets();

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
    sendChatRequest,
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
    maxContextLength,
    userTokens,
    aiTokens,
    chatMessageCount,
    userMessageCount,
    aiMessageCount,
    usagePercent,
    isCompressionThresholdReached,
  } = useChatStats(effectiveMessages, currentContextMessages, currentApiPreset, compressionThresholdPercent);

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
    loadApiPresets,
    initCharacters,
    initKnowledgeBases,
    loadMessages,
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
      cancelRequest,
      buildSystemMessages,
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
