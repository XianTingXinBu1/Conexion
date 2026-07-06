// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_KEYS } from '@/constants';

const localData = new Map<string, string>();
const indexedData = new Map<string, unknown>();

const localStorageMock = {
  get length() {
    return localData.size;
  },
  clear() {
    localData.clear();
  },
  getItem(key: string) {
    return localData.has(key) ? localData.get(key)! : null;
  },
  key(index: number) {
    return Array.from(localData.keys())[index] ?? null;
  },
  removeItem(key: string) {
    localData.delete(key);
  },
  setItem(key: string, value: string) {
    localData.set(key, String(value));
  },
} as Storage;

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  configurable: true,
});

vi.mock('idb-keyval', () => ({
  createStore: vi.fn(() => ({ name: 'mock-store' })),
  get: vi.fn(async (key: string) => indexedData.get(key)),
  set: vi.fn(async (key: string, value: unknown) => {
    indexedData.set(key, value);
  }),
  del: vi.fn(async (key: string) => {
    indexedData.delete(key);
  }),
  keys: vi.fn(async () => Array.from(indexedData.keys())),
  clear: vi.fn(async () => {
    indexedData.clear();
  }),
}));

describe('ensureStorageSchema', () => {
  beforeEach(() => {
    localStorage.clear();
    indexedData.clear();
    vi.resetModules();
  });

  it('normalizes stored entities, clears dangling knowledge base references, and is idempotent', async () => {
    localStorage.setItem(STORAGE_KEYS.STORAGE_SCHEMA_VERSION, JSON.stringify(0));
    localStorage.setItem(STORAGE_KEYS.PROMPT_MERGE_MODE, JSON.stringify('invalid'));
    indexedData.set(STORAGE_KEYS.API_PRESETS, [{ id: 'preset-1', name: 'Test', url: 'https://api.example.com', model: 'gpt' }]);
    indexedData.set(STORAGE_KEYS.PROMPT_PRESETS, [{ id: 'prompt-1', name: 'Prompt', items: [{ id: 'x', name: '角色设定', enabled: true, prompt: '' }] }]);
    indexedData.set(STORAGE_KEYS.USER_CHARACTERS, [{ id: 'user-1', name: 'Alice' }]);
    indexedData.set(STORAGE_KEYS.AI_CHARACTERS, [{ id: 'ai-1', name: 'Bot', description: 1, personality: null, knowledgeBaseId: 'missing-kb' }]);
    indexedData.set(STORAGE_KEYS.KNOWLEDGE_BASES, [{ id: 'kb-1', name: 'KB', entries: [{ id: 'entry-1', name: 'Fact', content: 'x' }] }]);
    indexedData.set(STORAGE_KEYS.REGEX_SCRIPTS, [{ id: 'r1', name: 'rule', pattern: 'a', replacement: 'b', scope: 'invalid' }]);
    indexedData.set(STORAGE_KEYS.CONVERSATIONS, [{ id: 'conv-1', messages: [] }]);

    const { ensureStorageSchema, STORAGE_SCHEMA_VERSION } = await import('../storageSchema');

    await expect(ensureStorageSchema()).resolves.toBe(STORAGE_SCHEMA_VERSION);

    const apiPresets = indexedData.get(STORAGE_KEYS.API_PRESETS) as Array<Record<string, unknown>>;
    expect(apiPresets[0]?.streamEnabled).toBe(true);
    expect(apiPresets[0]?.maxOutputTokens).toBe(4096);

    const aiCharacters = indexedData.get(STORAGE_KEYS.AI_CHARACTERS) as Array<Record<string, unknown>>;
    expect(aiCharacters[0]?.knowledgeBaseId).toBeUndefined();
    expect(aiCharacters[0]?.description).toBe('');
    expect(aiCharacters[0]?.personality).toBe('');

    const regexRules = indexedData.get(STORAGE_KEYS.REGEX_SCRIPTS) as Array<Record<string, unknown>>;
    expect(regexRules[0]?.scope).toBe('all');
    expect(regexRules[0]?.applyTo).toBe('after-macro');

    const promptPresets = indexedData.get(STORAGE_KEYS.PROMPT_PRESETS) as Array<Record<string, unknown>>;
    expect(promptPresets[0]?.items).toEqual([
      expect.objectContaining({
        id: 'x',
        roleType: 'system',
        insertPosition: 1,
      }),
    ]);

    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.PROMPT_MERGE_MODE) ?? 'null')).toBe('adjacent');
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.STORAGE_SCHEMA_VERSION) ?? 'null')).toBe(STORAGE_SCHEMA_VERSION);

    const snapshot = JSON.stringify({
      indexed: Object.fromEntries(indexedData.entries()),
      local: Object.fromEntries(localData.entries()),
    });
    await ensureStorageSchema();
    expect(JSON.stringify({
      indexed: Object.fromEntries(indexedData.entries()),
      local: Object.fromEntries(localData.entries()),
    })).toBe(snapshot);
  });

  it('migrates legacy localStorage data only when indexeddb target is empty', async () => {
    localStorage.setItem(STORAGE_KEYS.STORAGE_SCHEMA_VERSION, JSON.stringify(1));
    localStorage.setItem(STORAGE_KEYS.API_PRESETS, JSON.stringify([{ id: 'legacy', name: 'Legacy', url: 'https://legacy.example.com', model: 'legacy' }]));
    indexedData.set(STORAGE_KEYS.API_PRESETS, []);

    const { ensureStorageSchema } = await import('../storageSchema');
    await ensureStorageSchema();

    const migrated = indexedData.get(STORAGE_KEYS.API_PRESETS) as Array<Record<string, unknown>>;
    expect(migrated[0]?.id).toBe('legacy');

    localStorage.setItem(STORAGE_KEYS.STORAGE_SCHEMA_VERSION, JSON.stringify(1));
    indexedData.set(STORAGE_KEYS.API_PRESETS, [{ id: 'existing', name: 'Existing', url: 'https://existing.example.com', model: 'existing' }]);
    await ensureStorageSchema();

    const preserved = indexedData.get(STORAGE_KEYS.API_PRESETS) as Array<Record<string, unknown>>;
    expect(preserved[0]?.id).toBe('existing');
  });
});
