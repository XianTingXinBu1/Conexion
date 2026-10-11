import { ref } from 'vue';
import type { Ref } from 'vue';
import type { AICharacter, Message, RegexRule } from '@/types';
import { loadRegexRules as loadRegexRulesFromRepository } from '@/repositories/regexRuleRepository';
import { useChatPageInit } from './useChatPageInit';
import type { ChatPageProps } from './chatPageTypes';

interface UseChatLifecycleControllerOptions {
  props: ChatPageProps;
  effectiveMessages: Ref<Message[]>;
  currentCharacter: Ref<AICharacter | undefined>;
  chatHistoryLimit: Ref<number>;
  onPageLoad: () => void;
  loadAICharacter: (characterId: string) => Promise<AICharacter | undefined>;
  loadConversation: () => Promise<void>;
  syncVisibleMessages: () => void;
  loadPromptPresets: () => Promise<void>;
  loadApiPresets: () => Promise<void>;
  initCharacters: () => Promise<boolean> | void;
  initKnowledgeBases: () => Promise<boolean> | void;
  loadMessages: () => void;
  /**
   * 灌入角色开场白。回调同时拿到已加载的正则规则，
   * 因为开场白要跟 AI 输出走同一条管线。
   */
  seedGreeting?: (character: AICharacter, rules: RegexRule[]) => void | Promise<void>;
}

export function useChatLifecycleController(options: UseChatLifecycleControllerOptions) {
  const regexRules = ref<RegexRule[]>([]);

  const loadRegexRules = async () => {
    regexRules.value = await loadRegexRulesFromRepository();
  };

  useChatPageInit({
    props: options.props,
    messages: options.effectiveMessages,
    currentCharacter: options.currentCharacter,
    chatHistoryLimit: options.chatHistoryLimit,
    onPageLoad: options.onPageLoad,
    loadAICharacter: options.loadAICharacter,
    loadRegexRules,
    loadConversation: options.loadConversation,
    syncVisibleMessages: options.syncVisibleMessages,
    loadPromptPresets: options.loadPromptPresets,
    loadApiPresets: options.loadApiPresets,
    initCharacters: options.initCharacters,
    initKnowledgeBases: options.initKnowledgeBases,
    loadMessages: options.loadMessages,
    refreshVisibleMessages: options.syncVisibleMessages,
    seedGreeting: options.seedGreeting
      ? (character: AICharacter) => options.seedGreeting!(character, regexRules.value)
      : undefined,
  });

  return {
    regexRules,
    loadRegexRules,
  };
}
