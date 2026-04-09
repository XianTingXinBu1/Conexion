import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useChatApi } from '../useChatApi';
import { getStorage, setStorage } from '@/utils/storage';

vi.mock('@/utils/storage', () => ({
  getStorage: vi.fn(),
  setStorage: vi.fn(),
}));

const mockGetStorage = vi.mocked(getStorage);
const mockSetStorage = vi.mocked(setStorage);

function createPreset() {
  return {
    id: 'preset-1',
    name: 'test',
    url: 'https://api.example.com',
    apiKey: 'key',
    model: 'gpt-test',
    temperature: 0.7,
    maxOutputTokens: 256,
    streamEnabled: true,
    proxy: {
      enabled: false,
      url: '',
      type: 'query' as const,
      targetEndpoint: '',
    },
  };
}

describe('useChatApi', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockGetStorage.mockReset();
    mockSetStorage.mockReset();
    mockGetStorage.mockImplementation(async (key: string, defaultValue?: unknown) => {
      if (key === 'conexion_api_presets') {
        return [createPreset()];
      }
      if (key === 'conexion_selected_preset') {
        return 'preset-1';
      }
      return defaultValue;
    });
  });

  it('cancels active stream request and updates state', async () => {
    let readDeferred: { reject: (reason?: unknown) => void } | null = null;

    globalThis.fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const signal = init?.signal as AbortSignal | undefined;
      signal?.addEventListener('abort', () => {
        readDeferred?.reject(new DOMException('Aborted', 'AbortError'));
      }, { once: true });

      return {
        ok: true,
        body: {
          getReader() {
            return {
              read: () => new Promise((_, reject) => {
                readDeferred = { reject };
              }),
              releaseLock: vi.fn(),
            };
          },
        },
      } as Response;
    }) as typeof fetch;

    const api = useChatApi();
    const onError = vi.fn();

    const pending = api.sendStreamChatRequest(
      [{ id: '1', type: 'user', content: 'hi', timestamp: Date.now() }],
      vi.fn(),
      vi.fn(),
      onError,
    );

    await new Promise(resolve => setTimeout(resolve, 0));
    expect(api.isStreaming.value).toBe(true);

    api.cancelRequest();
    await pending;

    expect(api.isStreaming.value).toBe(false);
    expect(api.isLoading.value).toBe(false);
    expect(onError).toHaveBeenCalledWith('请求已取消');
  });
});
