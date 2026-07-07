import { ref } from 'vue';
import type { Ref } from 'vue';
import type { AICharacter, Message, RegexRule } from '@/types';
import { loadRegexRules as loadRegexRulesFromRepository } from '@/repositories/regexRuleRepository';
import { useChatPageInit } from '@/composables/useChatPageInit';
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
  initCharacters: () => Promise<boolean>;
  initKnowledgeBases: () => Promise<boolean>;
  loadMessages: () => void;
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
  });

  return {
    regexRules,
    loadRegexRules,
  };
}
