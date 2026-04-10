<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { ArrowLeft } from 'lucide-vue-next';
import type { Message, AICharacter, RegexRule, Conversation, UserCharacter, PromptPreset, ChatMessage } from '../types';
import { applyRules, clearRegexCache } from '../utils/regexEngine';
import { getStorage } from '@/utils/storage';
import {
  DEFAULT_AI_CHARACTERS,
  DEFAULT_REGEX_SCRIPTS,
  STORAGE_KEYS,
  DEFAULT_PROMPT_PRESETS,
} from '../constants';
import { ChatInput, MessageItem, ContextRing, TokenDetailsPanel, EditMessageModal, PromptPreviewModal } from './chat';
import { useChatApi } from '../composables/useChatApi';
import { useConfirmDialog } from '../composables/useConfirmDialog';
import { useCharacters } from '../composables/useCharacters';
import { useKnowledgeBases } from '../composables/useKnowledgeBases';
import { useApiPresets } from '../modules/api-preset';
import { useNotifications, getNotificationMessage } from '../modules/notification';
import { buildSystemPrompt } from '../modules/system-prompt';
import { logPrompt, logSystemPrompt } from '../modules/debug';
import { useConversationManager } from '../composables/useConversationManager';
import { useAppSettings } from '../composables/useAppSettings';
import { useTheme } from '../composables/useTheme';
import { useChatStats } from '../composables/useChatStats';
import { useChatViewport } from '../composables/useChatViewport';

import '../styles/common.css';
import '../styles/chat.css';

interface Props {
  character?: AICharacter;
  characterId?: string;
  conversationId?: string;
  userCharacter?: UserCharacter;
}

const props = defineProps<Props>();

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

// 加载 AI 角色数据
const loadAICharacter = async (characterId: string): Promise<AICharacter | undefined> => {
  const stored = await getStorage<AICharacter[]>(STORAGE_KEYS.AI_CHARACTERS, DEFAULT_AI_CHARACTERS);
  return stored.find(c => c.id === characterId);
};

// 当前角色对象（可能是从 props 传入的，也可能是从 characterId 加载的）
const currentCharacter = ref<AICharacter | undefined>(props.character);

const messages = ref<Message[]>([]);
const regexRules = ref<RegexRule[]>([]);

// 消息编辑和删除状态
const showEditModal = ref(false);
const editingMessageId = ref<string>('');
const editingMessageContent = ref('');

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


const getChatTitle = () => {
  if (currentCharacter.value?.name) {
    return currentCharacter.value.name;
  }
  if (currentConversation.value?.characterName) {
    return currentConversation.value.characterName;
  }
  return '临时会话';
};

const getChatSubtitle = () => {
  if (currentCharacter.value || currentConversation.value?.characterName) {
    return 'AI Character';
  }
  return 'TemporaryConversation';
};

// 消息编辑和删除处理函数
const handleEditMessage = (messageId: string) => {
  const message = messages.value.find(m => m.id === messageId);
  if (message) {
    editingMessageId.value = messageId;
    editingMessageContent.value = message.content;
    showEditModal.value = true;
  }
};

const handleSaveEdit = async (messageId: string, newContent: string) => {
  const success = await editMessage(messageId, newContent);
  if (success) {
    const message = messages.value.find(m => m.id === messageId);
    if (message) {
      message.content = newContent;
    }
    showSuccess('编辑成功', '消息已更新');
  } else {
    showError('编辑失败', '无法编辑临时会话的消息');
  }
};

const handleDeleteMessage = (messageId: string) => {
  const message = messages.value.find(m => m.id === messageId);
  if (message) {
    showDeleteConfirmDialog(messageId, `消息 #${message.content.slice(0, 20)}...`, '这条消息');
  }
};

const confirmDelete = async () => {
  const messageId = confirmDeleteMessage();
  if (messageId) {
    const success = await deleteMessage(messageId);
    if (success) {
      const index = messages.value.findIndex(m => m.id === messageId);
      if (index !== -1) {
        messages.value.splice(index, 1);
      }
      showSuccess('删除成功', '消息已删除');
    } else {
      showError('删除失败', '无法删除临时会话的消息');
    }
  }
};

const handleShowPromptAssistant = () => {
  // 实时构建提示词
  const currentPreset = getCurrentPromptPreset();
  let systemMessages: ChatMessage[] = [];

  if (currentPreset) {
    logPrompt('实时构建提示词预览', { presetName: currentPreset.name, itemCount: currentPreset.items.length });
    const result = buildSystemPrompt({
      preset: currentPreset,
      aiCharacter: currentCharacter.value || undefined,
      userCharacter: selectedUser.value || undefined,
      knowledgeBases: knowledgeBases.value.filter(kb => kb.globallyEnabled),
      chatHistory: messages.value.filter(m => m.type !== 'system'),
      userInstruction: '',
      mergeMode: promptMergeMode.value,
    });
    systemMessages = result.messages;

    lastSystemPromptResult.value = {
      estimatedTokens: result.estimatedTokens,
      metadata: result.metadata,
    };
  } else {
    logPrompt('实时构建提示词预览（默认）');
    if (currentCharacter.value) {
      const parts: string[] = [];
      if (currentCharacter.value.name) {
        parts.push(`你的名字是：${currentCharacter.value.name}`);
      }
      if (currentCharacter.value.description) {
        parts.push(`你的描述：${currentCharacter.value.description}`);
      }
      if (currentCharacter.value.personality) {
        parts.push(`你的性格：${currentCharacter.value.personality}`);
      }
      if (parts.length > 0) {
        systemMessages.push({
          role: 'system' as const,
          content: parts.join('\n')
        });
      }
    }
    lastSystemPromptResult.value = {
      estimatedTokens: systemMessages.reduce((sum, msg) => sum + msg.content.length, 0),
    };
  }

  lastSystemMessages.value = systemMessages;
  showPromptPreview.value = true;
};

const { sendStreamChatRequest, usage, resetUsage } = useChatApi();
const { showSuccess, showError } = useNotifications();
const { selectedUser, init: initCharacters } = useCharacters();
const { knowledgeBases, init: initKnowledgeBases } = useKnowledgeBases();
const { currentPreset: currentApiPreset, loadPresets: loadApiPresets } = useApiPresets();

const {
  displayMessages,
  loadedCount,
  hasMoreMessages,
  loadMessages,
  loadMoreMessages,
  scrollToBottom,
} = useChatViewport(messages, chatHistoryLimit);

const {
  currentContextCount,
  maxContextLength,
  userTokens,
  aiTokens,
  chatMessageCount,
  userMessageCount,
  aiMessageCount,
} = useChatStats(messages, currentApiPreset);

const promptPresets = ref<PromptPreset[]>([]);
const selectedPromptPresetId = ref<string>('default');

const loadPromptPresets = async () => {
  const stored = await getStorage<PromptPreset[]>(STORAGE_KEYS.PROMPT_PRESETS, [...DEFAULT_PROMPT_PRESETS].map(p => ({
    ...p,
    items: [...p.items]
  })));
  if (stored) {
    promptPresets.value = stored;
  }

  const selectedId = await getStorage<string>(STORAGE_KEYS.SELECTED_PROMPT_PRESET, '');
  if (selectedId) {
    const exists = promptPresets.value.some(p => p.id === selectedId);
    if (exists) {
      selectedPromptPresetId.value = selectedId;
    }
  }
};

const getCurrentPromptPreset = (): PromptPreset | null => {
  return promptPresets.value.find(p => p.id === selectedPromptPresetId.value) || null;
};

const showTokenDetails = ref(false);
const toggleTokenDetails = () => {
  showTokenDetails.value = !showTokenDetails.value;
};

const lastSystemPromptResult = ref<{
  estimatedTokens: number;
  metadata?: {
    filledPlaceholders?: Record<string, { contentLength: number }>;
    totalItems: number;
    enabledItems: number;
  };
} | null>(null);

// 保存上一次构建的系统消息
const lastSystemMessages = ref<ChatMessage[]>([]);

// 提示词预览模态框
const showPromptPreview = ref(false);

const handleSendMessage = async (content: string) => {
  resetUsage();
  loadRegexRules();

  let processedContent = applyRules(content, 'user', 'after-macro', regexRules.value);

  const userMessage: Message = {
    id: Date.now().toString(),
    type: 'user',
    content: processedContent,
    timestamp: Date.now(),
  };
  messages.value.push(userMessage);

  if (!props.conversationId) {
    await createNewConversation(userMessage);
  } else {
    await saveConversation();
  }

  scrollToBottom();

  const assistantMessageId = (Date.now() + 1).toString();
  const assistantMessage: Message = {
    id: assistantMessageId,
    type: 'assistant',
    content: '',
    timestamp: Date.now(),
  };
  messages.value.push(assistantMessage);

  const chatHistory = messages.value.filter(m => m.id !== assistantMessageId && m.id !== userMessage.id);

  const currentPreset = getCurrentPromptPreset();
  let systemMessages: ChatMessage[] = [];

  if (currentPreset) {
    logPrompt('使用提示词预设', { presetName: currentPreset.name, itemCount: currentPreset.items.length });
    const result = buildSystemPrompt({
      preset: currentPreset,
      aiCharacter: currentCharacter.value || undefined,
      userCharacter: selectedUser.value || undefined,
      knowledgeBases: knowledgeBases.value.filter(kb => kb.globallyEnabled),
      chatHistory: chatHistory,
      userInstruction: processedContent,
      mergeMode: promptMergeMode.value,
    });
    systemMessages = result.messages;
    lastSystemMessages.value = systemMessages;

    lastSystemPromptResult.value = {
      estimatedTokens: result.estimatedTokens,
      metadata: result.metadata,
    };

    logSystemPrompt({
      presetName: currentPreset.name,
      messageCount: result.messages.length,
      usedItems: result.usedItemIds.length,
      skippedItems: result.skippedItemIds.length,
      estimatedTokens: result.estimatedTokens,
      userInstructionIncluded: result.userInstructionIncluded,
      allItems: currentPreset.items.map(item => ({
        id: item.id,
        name: item.name,
        enabled: item.enabled,
        insertPosition: item.insertPosition,
      })),
      enabledItems: currentPreset.items.filter(item => item.enabled).map(item => ({
        id: item.id,
        name: item.name,
        insertPosition: item.insertPosition,
      })),
      messages: result.messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      })),
    });
  } else {
    logPrompt('未找到提示词预设，使用默认构建');
    if (currentCharacter.value) {
      const parts: string[] = [];
      if (currentCharacter.value.name) {
        parts.push(`你的名字是：${currentCharacter.value.name}`);
      }
      if (currentCharacter.value.description) {
        parts.push(`你的描述：${currentCharacter.value.description}`);
      }
      if (currentCharacter.value.personality) {
        parts.push(`你的性格：${currentCharacter.value.personality}`);
      }
      if (parts.length > 0) {
        systemMessages.push({
          role: 'system' as const,
          content: parts.join('\n')
        });
      }
    }
    lastSystemMessages.value = systemMessages;
    lastSystemPromptResult.value = {
      estimatedTokens: systemMessages.reduce((sum, msg) => sum + msg.content.length, 0),
    };
  }

  try {
    await sendStreamChatRequest(
      chatHistory,
      (chunk: string) => {
        const msg = messages.value.find(m => m.id === assistantMessageId);
        if (msg) {
          msg.content += chunk;
          msg.content = applyRules(msg.content, 'assistant', 'after-macro', regexRules.value);
          scrollToBottom();
        }
      },
      () => {
        const msg = messages.value.find(m => m.id === assistantMessageId);
        if (msg) {
          msg.content = applyRules(msg.content, 'assistant', 'after-macro', regexRules.value);
          saveConversation();
          const notificationMsg = getNotificationMessage('CHAT_SEND_SUCCESS');
          showSuccess(notificationMsg.title, notificationMsg.message);
        }
      },
      (error: string) => {
        const msg = messages.value.find(m => m.id === assistantMessageId);
        if (msg) {
          msg.content = `错误: ${error}`;
          saveConversation();
          const notificationMsg = getNotificationMessage('CHAT_SEND_FAILED', { error });
          showError(notificationMsg.title, notificationMsg.message);
        }
      },
      undefined,
      systemMessages.length > 0 ? systemMessages : undefined
    );
  } catch (err) {
    const msg = messages.value.find(m => m.id === assistantMessageId);
    if (msg) {
      const errorMessage = err instanceof Error ? err.message : '发送失败';
      msg.content = errorMessage;
      saveConversation();
      const notificationMsg = getNotificationMessage('CHAT_SEND_FAILED', { error: errorMessage });
      showError(notificationMsg.title, notificationMsg.message);
    }
  }
};

onMounted(async () => {
  // 如果通过 characterId 参数传入了角色ID，则加载角色数据
  if (props.characterId && !props.character) {
    const loadedCharacter = await loadAICharacter(props.characterId);
    if (loadedCharacter) {
      currentCharacter.value = loadedCharacter;
    }
  }

  await loadRegexRules();
  await loadConversation();
  loadMessages();
  await loadPromptPresets();
  await loadApiPresets();
  initCharacters();
  initKnowledgeBases();
  scrollToBottom();
});

onUnmounted(() => {
  // 清理资源
});

watch(() => messages.value, () => {
  loadMessages();
  scrollToBottom();
}, { deep: true });
</script>

<template>
  <div class="chat-page">
    <header class="chat-header">
      <button class="nav-btn" @click="router.back()">
        <ArrowLeft :size="22" />
      </button>
      <div class="header-content">
        <div class="chat-title">{{ getChatTitle() }}</div>
        <div class="chat-subtitle">{{ getChatSubtitle() }}</div>
      </div>
      <ContextRing
        :current="currentContextCount"
        :max="maxContextLength"
        :theme="theme"
        :clickable="true"
        @click="toggleTokenDetails"
      />
    </header>

    <div class="chat-messages">
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
      :theme="theme"
      @close="toggleTokenDetails"
    />

    <ChatInput
      :enter-to-send="enterToSend"
      @send="handleSendMessage"
      @show-prompt-assistant="handleShowPromptAssistant"
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
      @refresh="handleShowPromptAssistant"
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