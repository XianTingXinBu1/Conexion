import type { AICharacter, UserCharacter } from '@/types';
import { DEFAULT_AI_CHARACTERS, DEFAULT_USER_CHARACTER, STORAGE_KEYS } from '@/constants';
import { getStorage, setStorage } from '@/utils/storage';

export async function loadUserCharacters(): Promise<UserCharacter[]> {
  const stored = await getStorage<UserCharacter[]>(STORAGE_KEYS.USER_CHARACTERS, [DEFAULT_USER_CHARACTER]);
  return Array.isArray(stored) && stored.length > 0 ? stored : [DEFAULT_USER_CHARACTER];
}

export async function saveUserCharacters(characters: UserCharacter[]): Promise<void> {
  await setStorage(STORAGE_KEYS.USER_CHARACTERS, characters);
}

export async function loadAICharacters(): Promise<AICharacter[]> {
  const stored = await getStorage<AICharacter[]>(STORAGE_KEYS.AI_CHARACTERS, [...DEFAULT_AI_CHARACTERS]);
  return Array.isArray(stored) && stored.length > 0 ? stored : [...DEFAULT_AI_CHARACTERS];
}

export async function saveAICharacters(characters: AICharacter[]): Promise<void> {
  await setStorage(STORAGE_KEYS.AI_CHARACTERS, characters);
}

export async function loadAICharacterById(id: string): Promise<AICharacter | undefined> {
  const characters = await loadAICharacters();
  return characters.find(character => character.id === id);
}

export async function loadSelectedUserCharacterId(): Promise<string | null> {
  return await getStorage<string | null>(STORAGE_KEYS.SELECTED_USER_CHARACTER, null);
}

export async function saveSelectedUserCharacterId(id: string): Promise<void> {
  await setStorage(STORAGE_KEYS.SELECTED_USER_CHARACTER, id);
}

export async function clearKnowledgeBaseReferenceFromAICharacters(knowledgeBaseId: string): Promise<boolean> {
  const aiCharacters = await getStorage<AICharacter[]>(STORAGE_KEYS.AI_CHARACTERS, []);
  const normalizedAICharacters = (Array.isArray(aiCharacters) ? aiCharacters : []).map(character =>
    character.knowledgeBaseId === knowledgeBaseId
      ? { ...character, knowledgeBaseId: undefined }
      : character
  );
  const changed = normalizedAICharacters.some((character, index) => character !== aiCharacters[index]);

  if (changed) {
    await saveAICharacters(normalizedAICharacters);
  }

  return changed;
}
