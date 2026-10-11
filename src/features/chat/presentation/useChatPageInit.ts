import { onMounted, watch, type Ref } from 'vue';
import type { AICharacter, Message } from '@/types';

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
  initCharacters: () => void | Promise<unknown>;
  initKnowledgeBases: () => void | Promise<unknown>;
  loadMessages: () => void;
  refreshVisibleMessages?: () => void;
  /** 进入角色会话时灌入开场白（是否需要由回调自行判断） */
  seedGreeting?: (character: AICharacter) => void | Promise<void>;
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
    refreshVisibleMessages,
    seedGreeting,
  } = options;

  /**
   * 角色会话的开场白：等角色 / 用户角色加载完再灌，
   * 否则开场白里的 {{user}} 会展开成空。
   */
  const seedGreetingIfNeeded = async (charactersReady: void | Promise<unknown>) => {
    if (!seedGreeting) return;
    if (!props.characterId || props.conversationId) return;

    const character = currentCharacter.value;
    if (!character) return;

    await charactersReady;
    await seedGreeting(character);
  };

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

    // 与之前一样先并发发起，不阻塞首屏（只把结果拿给开场白用）
    const charactersReady = initCharacters();
    initKnowledgeBases();
    onPageLoad();

    await seedGreetingIfNeeded(charactersReady);
  });

  watch(
    [() => messages.value.length, chatHistoryLimit],
    () => {
      loadMessages();
      refreshVisibleMessages?.();
    },
    { immediate: true }
  );
}
