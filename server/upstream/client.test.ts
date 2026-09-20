/**
 * 后端上游代理的重试策略测试。
 *
 * 重试放在后端的原因：只有后端知道请求是否幂等。
 * 这里锁定策略边界：
 * - GET（幂等）失败会重试，且重试后成功要返回成功结果
 * - POST（非幂等）一律不重试，避免上游重复生成
 * - 超时不重试，避免总等待时间翻倍
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { proxyUpstreamRequest } from './client';
import { UpstreamRequestError } from '../errors';

const UPSTREAM_URL = 'https://upstream.example.com/v1/models';

const jsonResponse = (body: unknown, status: number): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('上游代理重试策略', () => {
  it('GET 遇 5xx 会重试，并在后续成功时返回成功结果', async () => {
    let calls = 0;
    vi.stubGlobal('fetch', vi.fn(async () => {
      calls += 1;
      return calls < 3
        ? jsonResponse({ error: { message: 'temporary' } }, 503)
        : jsonResponse({ data: [] }, 200);
    }));

    const result = await proxyUpstreamRequest({
      method: 'GET',
      upstreamUrl: UPSTREAM_URL,
      timeoutMs: 5000,
    });

    expect(calls).toBe(3);
    expect(result.status).toBe(200);
  });

  it('GET 全部失败时会在重试耗尽后返回最后一次的失败状态', async () => {
    let calls = 0;
    vi.stubGlobal('fetch', vi.fn(async () => {
      calls += 1;
      return jsonResponse({ error: { message: 'down' } }, 500);
    }));

    const result = await proxyUpstreamRequest({
      method: 'GET',
      upstreamUrl: UPSTREAM_URL,
      timeoutMs: 5000,
    });

    expect(calls).toBe(3);
    expect(result.status).toBe(500);
  });

  it('GET 遇网络错误会重试', async () => {
    let calls = 0;
    vi.stubGlobal('fetch', vi.fn(async () => {
      calls += 1;
      throw new TypeError('fetch failed');
    }));

    await expect(proxyUpstreamRequest({
      method: 'GET',
      upstreamUrl: UPSTREAM_URL,
      timeoutMs: 5000,
    })).rejects.toBeInstanceOf(UpstreamRequestError);

    expect(calls).toBe(3);
  });

  it('POST 遇 5xx 不重试，避免上游重复生成', async () => {
    let calls = 0;
    vi.stubGlobal('fetch', vi.fn(async () => {
      calls += 1;
      return jsonResponse({ error: { message: 'boom' } }, 502);
    }));

    const result = await proxyUpstreamRequest({
      method: 'POST',
      upstreamUrl: 'https://upstream.example.com/v1/chat/completions',
      body: JSON.stringify({ model: 'm', messages: [], stream: false }),
      timeoutMs: 5000,
    });

    expect(calls).toBe(1);
    expect(result.status).toBe(502);
  });

  it('POST 遇网络错误也不重试', async () => {
    let calls = 0;
    vi.stubGlobal('fetch', vi.fn(async () => {
      calls += 1;
      throw new TypeError('fetch failed');
    }));

    await expect(proxyUpstreamRequest({
      method: 'POST',
      upstreamUrl: 'https://upstream.example.com/v1/chat/completions',
      body: '{}',
      timeoutMs: 5000,
    })).rejects.toBeInstanceOf(UpstreamRequestError);

    expect(calls).toBe(1);
  });

  it('流式响应不做重试', async () => {
    let calls = 0;
    vi.stubGlobal('fetch', vi.fn(async () => {
      calls += 1;
      return new Response('data: [DONE]\n\n', {
        status: 500,
        headers: { 'Content-Type': 'text/event-stream' },
      });
    }));

    const result = await proxyUpstreamRequest({
      method: 'POST',
      upstreamUrl: 'https://upstream.example.com/v1/chat/completions',
      body: '{}',
      timeoutMs: 5000,
      stream: true,
    });

    expect(calls).toBe(1);
    expect(result.status).toBe(500);
  });

  it('超时不重试，避免等待时间翻倍', async () => {
    let calls = 0;
    vi.stubGlobal('fetch', vi.fn(async (_url: unknown, init: RequestInit) => {
      calls += 1;
      // 永不响应，只在被 abort 时按上游超时的语义拒绝
      return new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
      });
    }));

    await expect(proxyUpstreamRequest({
      method: 'GET',
      upstreamUrl: UPSTREAM_URL,
      timeoutMs: 30,
    })).rejects.toMatchObject({ statusCode: 504 });

    expect(calls).toBe(1);
  });
});
