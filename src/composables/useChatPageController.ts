import { ref, type Ref } from 'vue';
import type { AICharacter, KnowledgeBase, Message, UserCharacter } from '../types';
import type { MergeMode } from '../modules/system-prompt';

interface UseChatPageControllerOptions {
  currentCharacter: Ref<AICharacter | undefined>;
  selectedUser: Ref<UserCharacter | undefined>;
  knowledgeBases: Ref<KnowledgeBase[]>;
  messages: Ref<Message[]>;
  promptMergeMode: Ref<MergeMode>;
  showPromptAssistant: (context: {
    aiCharacter?: AICharacter;
    userCharacter?: UserCharacter;
    knowledgeBases: KnowledgeBase[];
    chatHistory: Message[];
    mergeMode: MergeMode;
  }) => void;
}

export function useChatPageController(options: UseChatPageControllerOptions) {
  const {
    currentCharacter,
    selectedUser,
    knowledgeBases,
    messages,
    promptMergeMode,
    showPromptAssistant,
  } = options;

  const showTokenDetails = ref(false);

  const openTokenDetails = () => {
    showTokenDetails.value = true;
  };

  const closeTokenDetails = () => {
    showTokenDetails.value = false;
  };

  const toggleTokenDetails = () => {
    showTokenDetails.value = !showTokenDetails.value;
  };

  const openPromptAssistant = () => {
    showPromptAssistant({
      aiCharacter: currentCharacter.value,
      userCharacter: selectedUser.value,
      knowledgeBases: knowledgeBases.value,
      chatHistory: messages.value.filter(message => message.type !== 'system'),
      mergeMode: promptMergeMode.value,
    });
  };

  return {
    showTokenDetails,
    openTokenDetails,
    closeTokenDetails,
    toggleTokenDetails,
    openPromptAssistant,
  };
}
