import { onMounted, watch, type Ref } from 'vue';
import type { AICharacter, Message } from '../types';

interface UseChatPageInitOptions {
  props: {
    character?: AICharacter;
    characterId?: string;
    conversationId?: string;
  };
  messages: Ref<Message[]>;
  currentCharacter: Ref<AICharacter | undefined>;
  chatHistoryLimit: Ref<number>;
  onPageLoad: () => void;
  loadAICharacter: (characterId: string) => Promise<AICharacter | undefined>;
  loadRegexRules: () => Promise<void>;
  loadConversation: () => Promise<void>;
  syncVisibleMessages: () => void;
  loadPromptPresets: () => Promise<void>;
  loadApiPresets: () => Promise<void>;
  initCharacters: () => void;
  initKnowledgeBases: () => void;
  loadMessages: () => void;
}

export function useChatPageInit(options: UseChatPageInitOptions) {
  const {
    props,
    messages,
    currentCharacter,
    chatHistoryLimit,
    onPageLoad,
    loadAICharacter,
    loadRegexRules,
    loadConversation,
    syncVisibleMessages,
    loadPromptPresets,
    loadApiPresets,
    initCharacters,
    initKnowledgeBases,
    loadMessages,
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
    onPageLoad();
  });

  watch(
    [() => messages.value.length, chatHistoryLimit],
    () => {
      loadMessages();
    },
    { immediate: true }
  );
}
