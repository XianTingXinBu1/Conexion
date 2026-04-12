import { onMounted, onUnmounted, watch, watchEffect, type Ref } from 'vue';
import type { AICharacter, Message } from '../types';

interface UseChatPageInitOptions {
  props: {
    character?: AICharacter;
    characterId?: string;
    conversationId?: string;
  };
  messages: Ref<Message[]>;
  displayMessages: Ref<Message[]>;
  currentCharacter: Ref<AICharacter | undefined>;
  chatHistoryLimit: Ref<number>;
  shouldAutoScrollOnStream: Ref<boolean>;
  loadAICharacter: (characterId: string) => Promise<AICharacter | undefined>;
  loadRegexRules: () => Promise<void>;
  loadConversation: () => Promise<void>;
  syncVisibleMessages: () => void;
  loadPromptPresets: () => Promise<void>;
  loadApiPresets: () => Promise<void>;
  initCharacters: () => void;
  initKnowledgeBases: () => void;
  scrollToBottom: (force?: boolean) => Promise<void>;
  loadMessages: () => void;
  isNearBottom: () => boolean;
}

export function useChatPageInit(options: UseChatPageInitOptions) {
  const {
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
  } = options;

  onMounted(async () => {
    if (props.characterId && !props.character) {
      const loadedCharacter = await loadAICharacter(props.characterId);
      if (loadedCharacter) {
        currentCharacter.value = loadedCharacter;
      }
    }

    await loadRegexRules();
    await loadConversation();
    syncVisibleMessages();
    await loadPromptPresets();
    await loadApiPresets();
    initCharacters();
    initKnowledgeBases();
    await scrollToBottom(true);
  });

  onUnmounted(() => {
    // 清理资源
  });

  watch(
    [() => messages.value.length, chatHistoryLimit],
    () => {
      loadMessages();
    },
    { immediate: true }
  );

  watchEffect(() => {
    for (const message of displayMessages.value) {
      message.content;
    }

    if (displayMessages.value.length > 0 && messages.value.length > 0) {
      shouldAutoScrollOnStream.value = isNearBottom();
    }
  });
}
