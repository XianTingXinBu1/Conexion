<script setup lang="ts">
import { ref, computed, defineAsyncComponent } from 'vue';
import { useRouter } from 'vue-router';
import { ArrowLeft } from 'lucide-vue-next';
import type { Message, AICharacter, RegexRule, Conversation, UserCharacter } from '../types';
import { clearRegexCache } from '../utils/regexEngine';
import { getStorage } from '@/utils/storage';
import {
  DEFAULT_AI_CHARACTERS,
  DEFAULT_REGEX_SCRIPTS,
  STORAGE_KEYS,
} from '../constants';
import { ChatInput, MessageItem, ContextRing } from './chat';
import { useChatApi } from '../composables/useChatApi';
import { useConfirmDialog } from '../composables/useConfirmDialog';
import { useCharacters } from '../composables/useCharacters';
import { useKnowledgeBases } from '../composables/useKnowledgeBases';
import { useApiPresets } from '../modules/api-preset';
import { useNotifications, getNotificationMessage } from '../modules/notification';
import { useConversationManager } from '../composables/useConversationManager';
import { useAppSettings } from '../composables/useAppSettings';
import { useTheme } from '../composables/useTheme';
import { useChatStats } from '../composables/useChatStats';
import { useChatViewport } from '../composables/useChatViewport';
import { useChatScrollPolicy } from '../composables/useChatScrollPolicy';
import { useChatMessageActions } from '../composables/useChatMessageActions';
import { useChatPromptBuilder } from '../composables/useChatPromptBuilder';
import { useChatSendFlow } from '../composables/useChatSendFlow';
import { useChatPageInit } from '../composables/useChatPageInit';
import { useChatSessionMeta } from '../composables/useChatSessionMeta';
import { useChatPageController } from '../composables/useChatPageController';
import { useConversationCompression } from '../composables/useConversationCompression';
import { isTemporaryConversationId } from '@/services/conversationRepository';

import '../styles/common.css';
import '../styles/chat.css';

interface Props {
  character?: AICharacter;
  characterId?: string;
  conversationId?: string;
  userCharacter?: UserCharacter;
}

const props = defineProps<Props>();

const TokenDetailsPanel = defineAsyncComponent(() => import('./chat/TokenDetailsPanel.vue'));
const EditMessageModal = defineAsyncComponent(() => import('./chat/EditMessageModal.vue'));
const PromptPreviewModal = defineAsyncComponent(() => import('./chat/PromptPreviewModal.vue'));

// 获取应用设置和主题
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
const persistedConversationId = computed(() => currentConversation.value?.id);
const canUseConversationCompression = computed(() => {
  const conversationId = currentConversation.value?.id;
  return !!conversationId && !isTemporaryConversationId(conversationId);
});

// 加载 AI 角色数据
const loadAICharacter = async (characterId: string): Promise<AICharacter | undefined> => {
  const stored = await getStorage<AICharacter[]>(STORAGE_KEYS.AI_CHARACTERS, DEFAULT_AI_CHARACTERS);
  return stored.find(c => c.id === characterId);
};

// 当前角色对象（可能是从 props 传入的，也可能是从 characterId 加载的）
const currentCharacter = ref<AICharacter | undefined>(props.character);

const messages = ref<Message[]>([]);
const regexRules = ref<RegexRule[]>([]);

// 使用确认对话框 composable
const {
  confirmDialogProps,
  showDeleteConfirm: showDeleteConfirmDialog,
  confirmDelete: confirmDeleteMessage,
  cancelDelete,
  ConfirmDialog: ConfirmDialogComponent,
} = useConfirmDialog();

// 使用会话管理器
const {
  currentConversation,
  loadConversation: loadConv,
  createNewConversation: createConv,
  saveConversation: saveConv,
  setCurrentConversationId,
  editMessage,
  deleteMessage,
} = useConversationManager(() => {
  // 会话更新时不需要通过 emit 通知父组件，因为使用 Vue Router
});

// 初始化会话ID
setCurrentConversationId(props.conversationId);

const loadConversation = async () => {
  messages.value = await loadConv(props.conversationId);
};

const createNewConversation = async (firstMessage: Message): Promise<Conversation> => {
  return await createConv(firstMessage, currentCharacter.value);
};

const saveConversation = async (nextMessages = messages.value, updates: Partial<Conversation> = {}) => {
  await saveConv(nextMessages, updates);
};

const loadRegexRules = async () => {
  clearRegexCache();

  const stored = await getStorage<RegexRule[]>(STORAGE_KEYS.REGEX_SCRIPTS, [...DEFAULT_REGEX_SCRIPTS]);
  regexRules.value = stored;
};

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
} = useConversationCompression({
  messages,
  currentConversation,
  saveConversation,
  sendChatRequest,
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
  currentContextCount,
  maxContextLength,
  userTokens,
  aiTokens,
  chatMessageCount,
  userMessageCount,
  aiMessageCount,
  usagePercent,
  isCompressionThresholdReached,
} = useChatStats(messages, currentApiPreset, compression, compressionThresholdPercent);

const {
  lastSystemPromptResult,
  lastSystemMessages,
  showPromptPreview,
  loadPromptPresets,
  showPromptAssistant,
  buildSystemMessages,
} = useChatPromptBuilder();

const {
  showTokenDetails,
  closeTokenDetails,
  toggleTokenDetails,
  openPromptAssistant,
} = useChatPageController({
  currentCharacter,
  selectedUser,
  knowledgeBases,
  messages: effectiveMessages,
  promptMergeMode,
  compressionSummary: compressionPromptContent,
  showPromptAssistant,
});

const handleCompressConversation = async () => {
  if (isCompressing.value) {
    return;
  }

  if (!canUseConversationCompression.value) {
    showInfo('暂不支持', '请先创建已保存会话后再压缩。');
    return;
  }

  if (!canCompress.value) {
    showInfo('无需压缩', '当前会话可压缩的历史不足。');
    return;
  }

  try {
    const compressed = await compressConversation();
    if (!compressed) {
      showInfo('无需压缩', '当前会话可压缩的历史不足。');
      return;
    }

    const msg = getNotificationMessage('CHAT_COMPRESSION_SUCCESS');
    showSuccess(msg.title, msg.message);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '压缩失败';
    const msg = getNotificationMessage('CHAT_COMPRESSION_FAILED', { error: errorMessage });
    showError(msg.title, msg.message);
  }
};

const {
  isSending,
  handleSendMessage,
  handleCancelSend,
} = useChatSendFlow({
  messages,
  requestMessages: effectiveMessages,
  regexRules,
  currentCharacter,
  selectedUser,
  knowledgeBases,
  promptMergeMode,
  compressionMode,
  canUseConversationCompression,
  isCompressionThresholdReached,
  compressConversation,
  isCompressingConversation: isCompressing,
  compressionSummary: compressionPromptContent,
  persistedConversationId,
  resetUsage,
  loadRegexRules,
  createNewConversation,
  saveConversation: () => saveConversation(),
  onStreamFlush: scrollPolicy.onStreamFlush,
  onMessageSend: scrollPolicy.onMessageSend,
  sendStreamChatRequest,
  cancelRequest,
  buildSystemMessages,
  showSuccess,
  showError,
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

useChatPageInit({
  props,
  messages: effectiveMessages,
  currentCharacter,
  chatHistoryLimit,
  onPageLoad: scrollPolicy.onPageLoad,
  loadAICharacter,
  loadRegexRules,
  loadConversation,
  syncVisibleMessages,
  loadPromptPresets,
  loadApiPresets,
  initCharacters,
  initKnowledgeBases,
  loadMessages,
  refreshVisibleMessages: syncVisibleMessages,
});
</script>

<template>
  <div class="chat-page">
    <header class="chat-header">
      <button class="nav-btn" @click="router.back()">
        <ArrowLeft :size="22" />
      </button>
      <div class="header-content">
        <div class="chat-title-row">
          <div class="chat-title">{{ chatTitle }}</div>
          <span v-if="compressionSummary" class="compression-badge">已压缩</span>
        </div>
        <div class="chat-subtitle">{{ chatSubtitle }}</div>
      </div>
      <ContextRing
        :current="currentContextCount"
        :max="maxContextLength"
        :theme="theme"
        :clickable="true"
        @click="toggleTokenDetails"
      />
    </header>

    <div
      v-if="canUseConversationCompression && isCompressionThresholdReached"
      class="compression-warning"
      :class="theme"
    >
      <div>
        上下文使用率已达到 {{ usagePercent }}%（阈值 {{ compressionThresholdPercent }}%）。
        <span v-if="compressionMode === 'auto'">下次发送前会自动压缩。</span>
        <span v-else>建议先压缩会话以保留关键上下文。</span>
      </div>
      <button
        v-if="compressionMode === 'manual'"
        class="compression-warning-btn"
        :disabled="isCompressing"
        @click="handleCompressConversation"
      >
        立即压缩
      </button>
    </div>

    <div :ref="(el) => { chatViewport.messagesContainer.value = el as HTMLElement | undefined; }" class="chat-messages">
      <button
        v-if="hasMoreMessages"
        class="load-more-btn"
        @click="loadMoreMessages"
      >
        加载更多历史消息 ({{ chatMessageCount - loadedCount }} 条未加载)
      </button>
      <MessageItem
        v-for="(message, index) in displayMessages"
        :key="message.id"
        :message="message"
        :index="index"
        :total-messages="chatMessageCount"
        :display-count="displayMessages.length"
        :theme="theme"
        :enable-markdown="enableMarkdown"
        :show-word-count="showWordCount"
        :show-message-index="showMessageIndex"
        @edit="handleEditMessage"
        @delete="handleDeleteMessage"
      />
    </div>

    <!-- Token 使用详情侧栏 -->
    <TokenDetailsPanel
      v-if="showTokenDetails"
      :current-context-count="currentContextCount"
      :max-context-length="maxContextLength"
      :user-tokens="userTokens"
      :ai-tokens="aiTokens"
      :chat-message-count="chatMessageCount"
      :user-message-count="userMessageCount"
      :ai-message-count="aiMessageCount"
      :last-system-prompt-result="lastSystemPromptResult"
      :current-api-preset="currentApiPreset || null"
      :usage="usage"
      :response-metrics="responseMetrics"
      :theme="theme"
      :usage-percent="usagePercent"
      :compression-threshold-percent="compressionThresholdPercent"
      :compression-mode="compressionMode"
      :compression-summary="compressionSummary"
      :is-compression-threshold-reached="isCompressionThresholdReached"
      :is-compressing="isCompressing"
      :show-compression-section="canUseConversationCompression"
      :can-compress="canCompress && canUseConversationCompression"
      @close="closeTokenDetails"
      @compress="handleCompressConversation"
    />

    <ChatInput
      :enter-to-send="enterToSend"
      :is-sending="isSending"
      :is-request-active="isRequestActive"
      :request-status="requestStatus"
      @send="handleSendMessage"
      @cancel="handleCancelSend"
      @focus="scrollPolicy.onInputFocus"
      @show-prompt-assistant="openPromptAssistant"
    />

    <!-- 编辑消息模态框 -->
    <EditMessageModal
      :show="showEditModal"
      :message-id="editingMessageId"
      :content="editingMessageContent"
      @update:show="showEditModal = false"
      @save="handleSaveEdit"
    />

    <!-- 提示词预览模态框 -->
    <PromptPreviewModal
      :show="showPromptPreview"
      :system-messages="lastSystemMessages"
      :estimated-tokens="lastSystemPromptResult?.estimatedTokens"
      :theme="theme"
      @update:show="showPromptPreview = false"
      @refresh="openPromptAssistant"
    />

    <!-- 删除确认对话框 -->
    <component
      :is="ConfirmDialogComponent"
      v-bind="confirmDialogProps"
      @confirm="confirmDelete"
      @cancel="cancelDelete"
      @update-show="cancelDelete"
    />
  </div>
</template>

<style scoped>
.chat-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.compression-warning-btn {
  border: none;
  border-radius: 10px;
  background: rgba(157, 141, 241, 0.14);
  color: var(--accent-purple);
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.compression-warning-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.compression-warning-btn:active {
  transform: scale(0.97);
}

.compression-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(16, 185, 129, 0.14);
  color: #059669;
  font-size: 11px;
  font-weight: 700;
}

.compression-warning {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 16px;
  font-size: 12px;
  line-height: 1.5;
  border-bottom: 1px solid var(--border-color);
}

.compression-warning.light {
  background: rgba(245, 158, 11, 0.08);
  color: #92400e;
}

.compression-warning.dark {
  background: rgba(245, 158, 11, 0.12);
  color: #fbbf24;
}
</style>
