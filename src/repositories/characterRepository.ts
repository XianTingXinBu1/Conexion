import type { AICharacter, UserCharacter } from '@/types';
import { DEFAULT_AI_CHARACTERS, DEFAULT_USER_CHARACTER, STORAGE_KEYS } from '@/constants';
import { getSetting, setSetting } from '@/repositories/settingsRepository';

const CHARACTER_API_BASE = '/api/characters';

async function readApiJson<T>(response: Response): Promise<T> {
  if (response.ok) {
    return await response.json() as T;
  }

  let message = `请求失败 (${response.status})`;
  try {
    const data = await response.json() as { error?: { message?: string }; message?: string };
    message = data.error?.message || data.message || message;
  } catch {
    // 保留默认错误信息
  }

  throw new Error(message);
}

async function requestJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${CHARACTER_API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  return readApiJson<T>(response);
}

export async function loadUserCharacters(): Promise<UserCharacter[]> {
  const characters = await requestJson<UserCharacter[]>('/users');
  return Array.isArray(characters) && characters.length > 0 ? characters : [DEFAULT_USER_CHARACTER];
}

export async function saveUserCharacters(characters: UserCharacter[]): Promise<void> {
  await requestJson<UserCharacter[]>('/users', {
    method: 'PUT',
    body: JSON.stringify({ characters }),
  });
}

export async function loadAICharacters(): Promise<AICharacter[]> {
  const characters = await requestJson<AICharacter[]>('/ai');
  return Array.isArray(characters) && characters.length > 0 ? characters : [...DEFAULT_AI_CHARACTERS];
}

export async function saveAICharacters(characters: AICharacter[]): Promise<void> {
  await requestJson<AICharacter[]>('/ai', {
    method: 'PUT',
    body: JSON.stringify({ characters }),
  });
}

export async function loadAICharacterById(id: string): Promise<AICharacter | undefined> {
  try {
    return await requestJson<AICharacter>(`/ai/${encodeURIComponent(id)}`);
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
  const result = await requestJson<{ changed: boolean }>('/ai/clear-knowledge-base-reference', {
    method: 'POST',
    body: JSON.stringify({ knowledgeBaseId }),
  });

  return result.changed;
}
