import { requestJson } from '@/api/http';
import type { AICharacter, UserCharacter } from '@/types';
import { DEFAULT_AI_CHARACTERS, DEFAULT_USER_CHARACTER, STORAGE_KEYS } from '@/constants';
import { getSetting, setSetting } from '@/repositories/settingsRepository';

const CHARACTER_API_BASE = '/api/characters';

function requestCharacters<T>(path: string, options: RequestInit = {}): Promise<T> {
  return requestJson<T>(`${CHARACTER_API_BASE}${path}`, options);
}

export async function loadUserCharacters(): Promise<UserCharacter[]> {
  const characters = await requestCharacters<UserCharacter[]>('/users');
  return Array.isArray(characters) && characters.length > 0 ? characters : [DEFAULT_USER_CHARACTER];
}

export async function saveUserCharacters(characters: UserCharacter[]): Promise<void> {
  await requestCharacters<UserCharacter[]>('/users', {
    method: 'PUT',
    body: JSON.stringify({ characters }),
  });
}

export async function loadAICharacters(): Promise<AICharacter[]> {
  const characters = await requestCharacters<AICharacter[]>('/ai');
  return Array.isArray(characters) && characters.length > 0 ? characters : [...DEFAULT_AI_CHARACTERS];
}

export async function saveAICharacters(characters: AICharacter[]): Promise<void> {
  await requestCharacters<AICharacter[]>('/ai', {
    method: 'PUT',
    body: JSON.stringify({ characters }),
  });
}

export async function loadAICharacterById(id: string): Promise<AICharacter | undefined> {
  try {
    return await requestCharacters<AICharacter>(`/ai/${encodeURIComponent(id)}`);
  } catch (error) {
    if (error instanceof Error && error.message === '角色不存在') {
      return undefined;
    }

    throw error;
  }
}

export async function loadSelectedUserCharacterId(): Promise<string | null> {
  return await getSetting<string | null>(STORAGE_KEYS.SELECTED_USER_CHARACTER, null);
}

export async function saveSelectedUserCharacterId(id: string): Promise<void> {
  await setSetting(STORAGE_KEYS.SELECTED_USER_CHARACTER, id);
}

export async function clearKnowledgeBaseReferenceFromAICharacters(knowledgeBaseId: string): Promise<boolean> {
  const result = await requestCharacters<{ changed: boolean }>('/ai/clear-knowledge-base-reference', {
    method: 'POST',
    body: JSON.stringify({ knowledgeBaseId }),
  });

  return result.changed;
}
