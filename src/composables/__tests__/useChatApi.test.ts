import { beforeEach, describe, expect, it, vi } from 'vitest';
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
  };
}

function createStreamingResponse(read: () => Promise<ReadableStreamReadResult<Uint8Array>>): Response {
  return {
    ok: true,
    body: {
      getReader() {
        return {
          read,
          releaseLock: vi.fn(),
        };
      },
    },
  } as unknown as Response;
}

describe('useChatApi', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
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

      return createStreamingResponse(() => new Promise((_, reject) => {
        readDeferred = { reject };
      }));
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
    expect(api.requestStatus.value).toBe('cancelled');
    expect(api.wasCancelled.value).toBe(true);
    expect(onError).toHaveBeenCalledWith('请求已取消');
  });

  it('reports stream errors only once', async () => {
    globalThis.fetch = vi.fn(async () => createStreamingResponse(async () => {
      throw new Error('boom');
    })) as typeof fetch;

    const api = useChatApi();
    const onError = vi.fn();

    await api.sendStreamChatRequest(
      [{ id: '1', type: 'user', content: 'hi', timestamp: Date.now() }],
      vi.fn(),
      vi.fn(),
      onError,
    );

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith('boom');
    expect(api.requestStatus.value).toBe('error');
  });

  it('flushes final decoder bytes and reports usage for stream completion', async () => {
    const encoder = new TextEncoder();
    const chunks = [
      encoder.encode('data: {"choices":[{"delta":{"content":"你"}}]}\r\n\r\n'),
      encoder.encode('data: {"choices":[{"delta":{"content":"好"}}],"usage":{"prompt_tokens":1,"completion_tokens":2,"total_tokens":3}}'),
    ];

    globalThis.fetch = vi.fn(async () => {
      let index = 0;
      return createStreamingResponse(async () => {
        if (index < chunks.length) {
          return { done: false, value: chunks[index++]! };
        }
        return { done: true, value: undefined };
      });
    }) as typeof fetch;

    const api = useChatApi();
    const onChunk = vi.fn();
    const onComplete = vi.fn();

    await api.sendStreamChatRequest(
      [{ id: '1', type: 'user', content: 'hi', timestamp: Date.now() }],
      onChunk,
      onComplete,
      vi.fn(),
    );

    expect(onChunk).toHaveBeenNthCalledWith(1, '你');
    expect(onChunk).toHaveBeenNthCalledWith(2, '好');
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(api.usage.value).toEqual({
      promptTokens: 1,
      completionTokens: 2,
      totalTokens: 3,
    });
    expect(api.requestStatus.value).toBe('completed');
  });

  it('distinguishes idle timeout from user cancellation', async () => {
    vi.useFakeTimers();

    globalThis.fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const signal = init?.signal as AbortSignal | undefined;
      return createStreamingResponse(() => new Promise((_resolve, reject) => {
        signal?.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'));
        }, { once: true });
      }));
    }) as typeof fetch;

    const api = useChatApi();
    const onError = vi.fn();

    const pending = api.sendStreamChatRequest(
      [{ id: '1', type: 'user', content: 'hi', timestamp: Date.now() }],
      vi.fn(),
      vi.fn(),
      onError,
    );

    await vi.advanceTimersByTimeAsync(30000);
    await pending;

    expect(onError).toHaveBeenCalledWith('流式响应空闲超时');
    expect(api.wasCancelled.value).toBe(false);
    expect(api.requestStatus.value).toBe('error');
  });
});
