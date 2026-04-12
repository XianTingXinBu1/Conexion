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
import { useNotifications } from '../modules/notification';
import { useConversationManager } from '../composables/useConversationManager';
import { useAppSettings } from '../composables/useAppSettings';
import { useTheme } from '../composables/useTheme';
import { useChatStats } from '../composables/useChatStats';
import { useChatViewport } from '../composables/useChatViewport';
import { useChatMessageActions } from '../composables/useChatMessageActions';
import { useChatPromptBuilder } from '../composables/useChatPromptBuilder';
import { useChatSendFlow } from '../composables/useChatSendFlow';
import { useChatPageInit } from '../composables/useChatPageInit';
import { useChatSessionMeta } from '../composables/useChatSessionMeta';
import { useChatPageController } from '../composables/useChatPageController';

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
} = useAppSettings();
const { theme } = useTheme();

const router = useRouter();
const persistedConversationId = computed(() => currentConversation.value?.id);

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

const saveConversation = async () => {
  await saveConv(messages.value);
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
  sendStreamChatRequest,
  cancelRequest,
  usage,
  responseMetrics,
  resetUsage,
  requestStatus,
  isRequestActive,
} = useChatApi();
const { showSuccess, showError } = useNotifications();
const { selectedUser, init: initCharacters } = useCharacters();
const { knowledgeBases, init: initKnowledgeBases } = useKnowledgeBases();
const { currentPreset: currentApiPreset, loadPresets: loadApiPresets } = useApiPresets();

const chatViewport = useChatViewport(messages, chatHistoryLimit);
const {
  displayMessages,
  loadedCount,
  hasMoreMessages,
  loadMessages,
  loadMoreMessages,
  syncVisibleMessages,
  isNearBottom,
  scrollToBottom,
} = chatViewport;

const {
  currentContextCount,
  maxContextLength,
  userTokens,
  aiTokens,
  chatMessageCount,
  userMessageCount,
  aiMessageCount,
} = useChatStats(messages, currentApiPreset);

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
  messages,
  promptMergeMode,
  showPromptAssistant,
});

const {
  shouldAutoScrollOnStream,
  isSending,
  handleSendMessage,
  handleCancelSend,
} = useChatSendFlow({
  messages,
  regexRules,
  currentCharacter,
  selectedUser,
  knowledgeBases,
  promptMergeMode,
  persistedConversationId,
  resetUsage,
  loadRegexRules,
  createNewConversation,
  saveConversation,
  scrollToBottom,
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
  messages,
  displayMessages,
  currentCharacter,
  chatHistoryLimit,
  shouldAutoScrollOnStream,
  loadAICharacter,
  loadRegexRules,
  loadConversation,
  syncVisibleMessages,
  loadPromptPresets,
  loadApiPresets,
  initCharacters,
  initKnowledgeBases,
  scrollToBottom,
  loadMessages,
  isNearBottom,
});
</script>

<template>
  <div class="chat-page">
    <header class="chat-header">
      <button class="nav-btn" @click="router.back()">
        <ArrowLeft :size="22" />
      </button>
      <div class="header-content">
        <div class="chat-title">{{ chatTitle }}</div>
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

    <div :ref="(el) => { chatViewport.messagesContainer.value = el as HTMLElement | undefined; }" class="chat-messages">
      <button
        v-if="hasMoreMessages"
        class="load-more-btn"
        @click="loadMoreMessages"
      >
        加载更多历史消息 ({{ messages.length - loadedCount }} 条未加载)
      </button>
      <MessageItem
        v-for="(message, index) in displayMessages"
        :key="message.id"
        :message="message"
        :index="index"
        :total-messages="messages.length"
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
      @close="closeTokenDetails"
    />

    <ChatInput
      :enter-to-send="enterToSend"
      :is-sending="isSending"
      :is-request-active="isRequestActive"
      :request-status="requestStatus"
      @send="handleSendMessage"
      @cancel="handleCancelSend"
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