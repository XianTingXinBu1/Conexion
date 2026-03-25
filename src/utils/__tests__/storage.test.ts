// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const clearMock = vi.fn(async () => undefined);
const idbKeysMock = vi.fn(async () => ['conexion_models', 'conexion_conversations']);

vi.mock('idb-keyval', () => ({
  createStore: vi.fn(() => ({ name: 'mock-store' })),
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  keys: idbKeysMock,
  clear: clearMock,
}));

describe('storage helpers', () => {
  beforeEach(() => {
    localStorage.clear();
    clearMock.mockClear();
    idbKeysMock.mockClear();
  });

  it('clearStorage removes only conexion local keys and clears indexeddb store', async () => {
    localStorage.setItem('conexion_theme', '"dark"');
    localStorage.setItem('conexion_prompt_merge_mode', '"adjacent"');
    localStorage.setItem('unrelated_key', 'keep-me');

    const { clearStorage } = await import('../storage');

    await clearStorage();

    expect(localStorage.getItem('conexion_theme')).toBeNull();
    expect(localStorage.getItem('conexion_prompt_merge_mode')).toBeNull();
    expect(localStorage.getItem('unrelated_key')).toBe('keep-me');
    expect(clearMock).toHaveBeenCalledTimes(1);
  });

  it('getAllStorageKeys merges local and indexeddb keys', async () => {
    localStorage.setItem('conexion_theme', '"light"');
    localStorage.setItem('not_conexion', 'ignore');

    const { getAllStorageKeys } = await import('../storage');

    await expect(getAllStorageKeys()).resolves.toEqual([
      'conexion_theme',
      'conexion_models',
      'conexion_conversations',
    ]);
    expect(idbKeysMock).toHaveBeenCalledTimes(1);
  });
});
