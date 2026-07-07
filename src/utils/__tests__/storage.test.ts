// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const testLocalStorage = {} as Storage;
const storageData: Record<string, string> = {};

Object.defineProperties(testLocalStorage, {
  length: {
    get: () => Object.keys(storageData).length,
  },
  clear: {
    value: () => {
      Object.keys(storageData).forEach(key => {
        delete storageData[key];
        delete (testLocalStorage as unknown as Record<string, string>)[key];
      });
    },
  },
  getItem: {
    value: (key: string) => storageData[key] ?? null,
  },
  key: {
    value: (index: number) => Object.keys(storageData)[index] ?? null,
  },
  removeItem: {
    value: (key: string) => {
      delete storageData[key];
      delete (testLocalStorage as unknown as Record<string, string>)[key];
    },
  },
  setItem: {
    value: (key: string, value: string) => {
      storageData[key] = String(value);
      Object.defineProperty(testLocalStorage, key, {
        value: String(value),
        enumerable: true,
        configurable: true,
      });
    },
  },
});

Object.defineProperty(globalThis, 'localStorage', {
  value: testLocalStorage,
  configurable: true,
});

const delMock = vi.fn(async () => undefined);

vi.mock('idb-keyval', () => ({
  createStore: vi.fn(() => ({ name: 'mock-store' })),
  del: delMock,
}));

describe('legacy storage cleanup helpers', () => {
  beforeEach(() => {
    localStorage.clear();
    delMock.mockClear();
  });

  it('removeStorage drops the key from localStorage and legacy IndexedDB', async () => {
    localStorage.setItem('conexion_theme', '"dark"');

    const { removeStorage, dbStore } = await import('../storage');

    await removeStorage('conexion_theme');

    expect(localStorage.getItem('conexion_theme')).toBeNull();
    expect(delMock).toHaveBeenCalledWith('conexion_theme', dbStore);
  });
});
