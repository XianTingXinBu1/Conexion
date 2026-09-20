// @vitest-environment happy-dom
/**
 * ApiClient 请求行为测试。
 *
 * 重点锁定一件事：前端不再重试。
 * 重试策略已下沉到后端代理，前端重发 POST 会造成重复计费与重复生成，
 * 所以这里断言任意失败场景下 fetch 都只被调用一次。
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiClient } from '@/api/base';

const createClient = () => new ApiClient({ baseURL: 'https://upstream.example.com/v1' });

const jsonResponse = (body: unknown, status: number): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ApiClient 不再重试', () => {
  it('POST 遇 5xx 只请求一次', async () => {
    let calls = 0;
    vi.stubGlobal('fetch', vi.fn(async () => {
      calls += 1;
      return jsonResponse({ error: { message: 'boom' } }, 502);
    }));

    await expect(createClient().post('/chat/completions', { model: 'm', messages: [] }))
      .rejects.toThrow(/API 请求失败 \(502\)/);

    expect(calls).toBe(1);
  });

  it('GET 遇 5xx 也只请求一次', async () => {
    let calls = 0;
    vi.stubGlobal('fetch', vi.fn(async () => {
      calls += 1;
      return jsonResponse({ error: { message: 'boom' } }, 503);
    }));

    await expect(createClient().get('/models')).rejects.toThrow();

    expect(calls).toBe(1);
  });

  it('网络错误只请求一次', async () => {
    let calls = 0;
    vi.stubGlobal('fetch', vi.fn(async () => {
      calls += 1;
      throw new TypeError('Failed to fetch');
    }));

    await expect(createClient().post('/chat/completions', {})).rejects.toThrow('Failed to fetch');

    expect(calls).toBe(1);
  });

  it('cancelActiveRequest 能中止进行中的非流式请求', async () => {
    let aborted = false;
    vi.stubGlobal('fetch', vi.fn(async (_url: unknown, init: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => {
          aborted = true;
          reject(init.signal?.reason);
        }, { once: true });
      });
    }));

    const client = createClient();
    const pending = client.post('/chat/completions', { model: 'm' }).catch(e => e);

    await new Promise(resolve => setTimeout(resolve, 10));
    client.cancelActiveRequest();

    const error = await pending;

    expect(aborted).toBe(true);
    expect((error as Error).name).toBe('AbortError');
  });

  it('没有在飞请求时 cancelActiveRequest 是空操作', () => {
    const client = createClient();

    expect(() => client.cancelActiveRequest()).not.toThrow();
  });

  it('成功路径仍正常返回', async () => {
    let calls = 0;
    vi.stubGlobal('fetch', vi.fn(async () => {
      calls += 1;
      return jsonResponse({ ok: true }, 200);
    }));

    const client = new ApiClient({ baseURL: 'https://upstream.example.com/v1', apiKey: 'k' });
    await expect(client.get('/x')).resolves.toEqual({ ok: true });

    expect(calls).toBe(1);
  });
});
