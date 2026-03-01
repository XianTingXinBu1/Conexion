<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, watch, computed } from 'vue';
import { useRouter } from 'vue-router';
import { ArrowLeft } from 'lucide-vue-next';
import type { Theme, Message, AICharacter, RegexRule, Conversation, UserCharacter, PromptPreset, ChatMessage } from '../types';
import { applyRules, clearRegexCache } from '../utils/regexEngine';
import { countMessagesTokens } from '../utils/tokenCounter';
import { DEFAULT_REGEX_SCRIPTS, STORAGE_KEYS, DEFAULT_PROMPT_PRESETS } from '../constants';
import { ChatInput, MessageItem, ContextRing, TokenDetailsPanel } from './chat';
import { useChatApi } from '../composables/useChatApi';
import { useCharacters } from '../composables/useCharacters';
import { useKnowledgeBases } from '../composables/useKnowledgeBases';
import { useApiPresets } from '../modules/api-preset';
import { useNotifications, getNotificationMessage } from '../modules/notification';
import { buildSystemPrompt } from '../modules/system-prompt';
import { logPrompt, logSystemPrompt } from '../modules/debug';
import { useConversationManager } from '../composables/useConversationManager';

import '../styles/common.css';
import '../styles/chat.css';

interface Props {
  theme: Theme;
  enterToSend: boolean;
  showWordCount: boolean;
  enableMarkdown: boolean;
  showMessageIndex: boolean;
  chatHistoryLimit: number;
  promptMergeMode: 'none' | 'adjacent' | 'all';
  character?: AICharacter;
  conversationId?: string;
  userCharacter?: UserCharacter;
}

const props = defineProps<Props>();

const router = useRouter();

const messagesContainer = ref<HTMLElement>();
const messages = ref<Message[]>([]);
const displayMessages = ref<Message[]>([]);
const loadedCount = ref(0);
const regexRules = ref<RegexRule[]>([]);

// 使用会话管理器
const {
  currentConversation,
  loadConversation: loadConv,
  createNewConversation: createConv,
  saveConversation: saveConv,
  setCurrentConversationId,
} = useConversationManager(() => {
  // 会话更新时不需要通过 emit 通知父组件，因为使用 Vue Router
});

// 初始化会话ID
setCurrentConversationId(props.conversationId);

const loadConversation = async () => {
  messages.value = await loadConv(props.conversationId);
};

const createNewConversation = async (firstMessage: Message): Promise<Conversation> => {
  return await createConv(firstMessage, props.character);
};

const saveConversation = async () => {
  await saveConv(messages.value);
};

const loadRegexRules = async () => {
  clearRegexCache();

  const { getStorage } = await import('@/utils/storage');
  const stored = await getStorage<RegexRule[]>('conexion_regex_scripts', [...DEFAULT_REGEX_SCRIPTS]);
  regexRules.value = stored;
};

const hasMoreMessages = computed(() => {
  return loadedCount.value < messages.value.length;
});

const currentContextCount = computed(() => {
  try {
    const chatMessages = messages.value.map(msg => ({
      role: msg.type === 'user' ? 'user' : 'assistant',
      content: msg.content,
    }));
    return countMessagesTokens(chatMessages);
  } catch {
    return messages.value.length;
  }
});

const maxContextLength = computed(() => {
  return currentApiPreset.value?.maxTokens || 4096;
});

const userTokens = computed(() => {
  try {
    const userMessages = messages.value.filter(msg => msg.type === 'user');
    const chatMessages = userMessages.map(msg => ({
      role: 'user',
      content: msg.content,
    }));
    return countMessagesTokens(chatMessages);
  } catch {
    return 0;
  }
});

const aiTokens = computed(() => {
  try {
    const aiMessages = messages.value.filter(msg => msg.type === 'assistant');
    const chatMessages = aiMessages.map(msg => ({
      role: 'assistant',
      content: msg.content,
    }));
    return countMessagesTokens(chatMessages);
  } catch {
    return 0;
  }
});

const chatMessageCount = computed(() => {
  return messages.value.length;
});

const userMessageCount = computed(() => {
  return messages.value.filter(m => m.type === 'user').length;
});

const aiMessageCount = computed(() => {
  return messages.value.filter(m => m.type === 'assistant').length;
});

const loadMessages = () => {
  const limit = props.chatHistoryLimit;
  const totalCount = messages.value.length;

  if (totalCount <= limit) {
    displayMessages.value = [...messages.value];
    loadedCount.value = totalCount;
  } else {
    displayMessages.value = [...messages.value.slice(-limit)];
    loadedCount.value = limit;
  }
};

const loadMoreMessages = () => {
  const limit = props.chatHistoryLimit;
  const remaining = messages.value.length - loadedCount.value;

  if (remaining <= 0) return;

  const countToLoad = Math.min(limit, remaining);
  const newMessages = messages.value.slice(
    messages.value.length - loadedCount.value - countToLoad,
    messages.value.length - loadedCount.value
  );

  const oldScrollTop = messagesContainer.value?.scrollTop || 0;
  const oldScrollHeight = messagesContainer.value?.scrollHeight || 0;

  displayMessages.value = [...newMessages, ...displayMessages.value];
  loadedCount.value += countToLoad;

  nextTick(() => {
    if (messagesContainer.value) {
      const newScrollHeight = messagesContainer.value.scrollHeight;
      messagesContainer.value.scrollTop = oldScrollTop + (newScrollHeight - oldScrollHeight);
    }
  });
};

const getChatTitle = () => {
  if (props.character?.name) {
    return props.character.name;
  }
  if (currentConversation.value?.characterName) {
    return currentConversation.value.characterName;
  }
  return '临时会话';
};

const getChatSubtitle = () => {
  if (props.character || currentConversation.value?.characterName) {
    return 'AI Character';
  }
  return 'TemporaryConversation';
};

const scrollToBottom = async () => {
  await nextTick();
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
  }
};

const { sendStreamChatRequest, usage, resetUsage } = useChatApi();
const { showSuccess, showError } = useNotifications();
const { selectedUser, init: initCharacters } = useCharacters();
const { knowledgeBases, init: initKnowledgeBases } = useKnowledgeBases();
const { currentPreset: currentApiPreset, loadPresets: loadApiPresets } = useApiPresets();

const promptPresets = ref<PromptPreset[]>([]);
const selectedPromptPresetId = ref<string>('default');

const loadPromptPresets = async () => {
  const { getStorage } = await import('@/utils/storage');
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
      aiCharacter: props.character || undefined,
      userCharacter: selectedUser.value || undefined,
      knowledgeBases: knowledgeBases.value.filter(kb => kb.globallyEnabled),
      chatHistory: chatHistory,
      userInstruction: processedContent,
      mergeMode: props.promptMergeMode,
    });
    systemMessages = result.messages;

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
    if (props.character) {
      const parts: string[] = [];
      if (props.character.name) {
        parts.push(`你的名字是：${props.character.name}`);
      }
      if (props.character.description) {
        parts.push(`你的描述：${props.character.description}`);
      }
      if (props.character.personality) {
        parts.push(`你的性格：${props.character.personality}`);
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

    <div class="chat-messages" ref="messagesContainer">
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
    />
  </div>
</template>