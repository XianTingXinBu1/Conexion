import type { Ref } from 'vue';
import type { AICharacter, KnowledgeBase, Message, UserCharacter } from '@/types';
import type { MergeMode } from '@/modules/system-prompt';
import { useChatPromptBuilder, useChatPromptPanelController } from '@/modules/chat-prompt';

interface UseChatPromptControllerOptions {
  currentCharacter: Ref<AICharacter | undefined>;
  selectedUser: Ref<UserCharacter | undefined>;
  knowledgeBases: Ref<KnowledgeBase[]>;
  effectiveMessages: Ref<Message[]>;
  promptMergeMode: Ref<MergeMode>;
  compressionPromptContent: Ref<string>;
}

export function useChatPromptController(options: UseChatPromptControllerOptions) {
  const promptBuilder = useChatPromptBuilder();

  const pageController = useChatPromptPanelController({
    currentCharacter: options.currentCharacter,
    selectedUser: options.selectedUser,
    knowledgeBases: options.knowledgeBases,
    messages: options.effectiveMessages,
    promptMergeMode: options.promptMergeMode,
    compressionSummary: options.compressionPromptContent,
    showPromptAssistant: promptBuilder.showPromptAssistant,
  });

  return {
    ...promptBuilder,
    ...pageController,
  };
}
