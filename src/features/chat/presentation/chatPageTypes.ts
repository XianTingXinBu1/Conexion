import type { AICharacter, UserCharacter } from '@/types';

export interface ChatPageProps {
  character?: AICharacter;
  characterId?: string;
  conversationId?: string;
  userCharacter?: UserCharacter;
}
