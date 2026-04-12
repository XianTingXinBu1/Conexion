import { computed, type Ref } from 'vue';
import type { AICharacter, Conversation } from '../types';

interface UseChatSessionMetaOptions {
  currentCharacter: Ref<AICharacter | undefined>;
  currentConversation: Ref<Conversation | null | undefined>;
}

export function useChatSessionMeta(options: UseChatSessionMetaOptions) {
  const { currentCharacter, currentConversation } = options;

  const chatTitle = computed(() => {
    if (currentCharacter.value?.name) {
      return currentCharacter.value.name;
    }
    if (currentConversation.value?.characterName) {
      return currentConversation.value.characterName;
    }
    return '临时会话';
  });

  const chatSubtitle = computed(() => {
    if (currentCharacter.value || currentConversation.value?.characterName) {
      return 'AI Character';
    }
    return 'TemporaryConversation';
  });

  return {
    chatTitle,
    chatSubtitle,
  };
}
