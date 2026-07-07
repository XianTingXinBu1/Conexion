import type { AICharacter, UserCharacter } from '../../src/types';
import { DEFAULT_AI_CHARACTERS, DEFAULT_USER_CHARACTER } from '../../src/constants';
import type { AppStorage } from '../storage/appStorage';

const cloneUserCharacter = (character: UserCharacter): UserCharacter => ({ ...character });
const cloneAICharacter = (character: AICharacter): AICharacter => ({ ...character });

export class CharacterRepository {
  private readonly storage: AppStorage;

  constructor(storage: AppStorage) {
    this.storage = storage;
  }

  async listUserCharacters(): Promise<UserCharacter[]> {
    const characters = await this.storage.userCharacters.read();
    return Array.isArray(characters) && characters.length > 0
      ? characters.map(cloneUserCharacter)
      : [{ ...DEFAULT_USER_CHARACTER }];
  }

  async replaceUserCharacters(characters: UserCharacter[]): Promise<UserCharacter[]> {
    const nextCharacters = characters.length > 0
      ? characters.map(cloneUserCharacter)
      : [{ ...DEFAULT_USER_CHARACTER }];
    await this.storage.userCharacters.write(nextCharacters);
    return nextCharacters.map(cloneUserCharacter);
  }

  async listAICharacters(): Promise<AICharacter[]> {
    const characters = await this.storage.aiCharacters.read();
    return Array.isArray(characters) && characters.length > 0
      ? characters.map(cloneAICharacter)
      : [...DEFAULT_AI_CHARACTERS].map(cloneAICharacter);
  }

  async replaceAICharacters(characters: AICharacter[]): Promise<AICharacter[]> {
    const nextCharacters = characters.length > 0
      ? characters.map(cloneAICharacter)
      : [...DEFAULT_AI_CHARACTERS].map(cloneAICharacter);
    await this.storage.aiCharacters.write(nextCharacters);
    return nextCharacters.map(cloneAICharacter);
  }

  async getAICharacter(id: string): Promise<AICharacter | undefined> {
    const characters = await this.listAICharacters();
    const character = characters.find(item => item.id === id);
    return character ? cloneAICharacter(character) : undefined;
  }

  async clearKnowledgeBaseReference(knowledgeBaseId: string): Promise<boolean> {
    const aiCharacters = await this.listAICharacters();
    const nextCharacters = aiCharacters.map(character =>
      character.knowledgeBaseId === knowledgeBaseId
        ? { ...character, knowledgeBaseId: undefined }
        : character,
    );
    const changed = nextCharacters.some((character, index) => character !== aiCharacters[index]);

    if (changed) {
      await this.replaceAICharacters(nextCharacters);
    }

    return changed;
  }
}
