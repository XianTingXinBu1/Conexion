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
    /**
     * 逐步执行初始化，失败只记录不中断后续步骤。
     *
     * 以前整段是裸 await 串起来：任意一步 reject 都会让后面的会话加载、视口同步、
     * preset 初始化、onPageLoad、开场白全部被跳过，页面停在半初始化状态，
     * 同时抛一个未处理的 Promise rejection。
     */
    const runStep = async (label: string, step: () => Promise<unknown> | unknown) => {
      try {
        await step();
      } catch (error) {
        console.error(`[useChatPageInit] ${label}失败:`, error);
      }
    };

    await runStep('加载角色', async () => {
      if (props.characterId && !props.character) {
        const loadedCharacter = await loadAICharacter(props.characterId);
        if (loadedCharacter) {
          currentCharacter.value = loadedCharacter;
        }
      }
    });

    await runStep('加载正则规则', () => loadRegexRules());
    await runStep('加载会话', () => loadConversation());
    await runStep('同步可见消息', () => syncVisibleMessages());
    await runStep('加载提示词预设', () => loadPromptPresets());
    await runStep('加载 API 预设', () => loadApiPresets());

    // 与之前一样先并发发起，不阻塞首屏（只把结果拿给开场白用）。
    // 两者都要显式兜住：initKnowledgeBases 的返回值以前被直接丢弃，
    // charactersReady 也只在走到最后一行时才被 await。
    const charactersReady = Promise.resolve()
      .then(() => initCharacters())
      .catch(error => {
        console.error('[useChatPageInit] 初始化角色失败:', error);
      });

    void Promise.resolve()
      .then(() => initKnowledgeBases())
      .catch(error => {
        console.error('[useChatPageInit] 初始化知识库失败:', error);
      });

    await runStep('页面加载回调', () => onPageLoad());
    await runStep('灌入开场白', () => seedGreetingIfNeeded(charactersReady));
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
