import { computed, ref, type Ref } from 'vue';
import type { AICharacter, Conversation, Message } from '@/types';
import { loadAICharacterById } from '@/repositories/characterRepository';
import { useConversationManager } from '@/composables/useConversationManager';
import { isTemporaryConversationId } from '@/services/conversationRepository';
import type { ChatPageProps } from './chatPageTypes';

export function useChatSessionFacade(props: ChatPageProps) {
  const currentCharacter = ref<AICharacter | undefined>(props.character);
  const messages = ref<Message[]>([]);

  const {
    currentConversation,
    loadConversation: loadConversationFromManager,
    createNewConversation: createConversationFromManager,
    saveConversation: saveConversationToManager,
    setCurrentConversationId,
    editMessage,
    deleteMessage,
  } = useConversationManager(() => {
    // 会话更新时不需要通过 emit 通知父组件，因为使用 Vue Router
  });

  setCurrentConversationId(props.conversationId);

  const persistedConversationId = computed(() => currentConversation.value?.id);
  const canUseConversationCompression = computed(() => {
    const conversationId = currentConversation.value?.id;
    return !!conversationId && !isTemporaryConversationId(conversationId);
  });

  const loadAICharacter = async (characterId: string): Promise<AICharacter | undefined> => {
    return await loadAICharacterById(characterId);
  };

  const loadConversation = async () => {
    messages.value = await loadConversationFromManager(props.conversationId);
  };

  const createNewConversation = async (firstMessage: Message): Promise<Conversation> => {
    return await createConversationFromManager(firstMessage, currentCharacter.value);
  };

  const saveConversation = async (nextMessages = messages.value, updates: Partial<Conversation> = {}) => {
    await saveConversationToManager(nextMessages, updates);
  };

  return {
    currentCharacter: currentCharacter as Ref<AICharacter | undefined>,
    messages,
    currentConversation,
    persistedConversationId,
    canUseConversationCompression,
    loadAICharacter,
    loadConversation,
    createNewConversation,
    saveConversation,
    editMessage,
    deleteMessage,
  };
}
