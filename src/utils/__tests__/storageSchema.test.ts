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

  it('drops legacy frontend-owned data and keeps only the schema marker', async () => {
    for (const key of Object.values(STORAGE_KEYS)) {
      localStorage.setItem(key, JSON.stringify('legacy'));
    }

    for (const key of [
      STORAGE_KEYS.REGEX_SCRIPTS,
      STORAGE_KEYS.USER_CHARACTERS,
      STORAGE_KEYS.AI_CHARACTERS,
      STORAGE_KEYS.API_PRESETS,
      STORAGE_KEYS.MODELS,
      STORAGE_KEYS.CONVERSATIONS,
      STORAGE_KEYS.PROMPT_PRESETS,
      STORAGE_KEYS.KNOWLEDGE_BASES,
    ]) {
      indexedData.set(key, 'legacy');
    }

    const { ensureStorageSchema, STORAGE_SCHEMA_VERSION } = await import('../storageSchema');

    await expect(ensureStorageSchema()).resolves.toBe(STORAGE_SCHEMA_VERSION);

    for (const key of Object.values(STORAGE_KEYS)) {
      if (key === STORAGE_KEYS.STORAGE_SCHEMA_VERSION) {
        continue;
      }

      expect(localStorage.getItem(key)).toBeNull();
      expect(indexedData.has(key)).toBe(false);
    }

    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.STORAGE_SCHEMA_VERSION) ?? 'null')).toBe(STORAGE_SCHEMA_VERSION);
  });
});
