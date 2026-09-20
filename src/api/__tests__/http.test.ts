/**
 * 本地后端请求的行为测试。
 *
 * 本轮新增的核心能力是「超时」：本地数据请求原本没有任何超时保护，
 * 后端挂住会让界面永久等待。这里锁定：
 * - 超时会以 ApiTimeoutError 结束，并且只请求一次
 * - 超时与「调用方主动取消」是两种可区分的失败
 * - 请求结束后不残留超时定时器
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiTimeoutError } from '../errors';
import { requestJson } from '../http';
import { LOCAL_REQUEST_TIMEOUT_MS } from '../transport';

/** fetch 桩：永不响应，仅在 signal 被 abort 时以 abort reason 拒绝。 */
const hangingFetch = () => vi.fn(async (_url: unknown, init: RequestInit) => {
  return new Promise<Response>((_resolve, reject) => {
    init.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('本地请求超时', () => {
  it('超过 timeoutMs 后以 ApiTimeoutError 结束', async () => {
    const fetchMock = hangingFetch();
    vi.stubGlobal('fetch', fetchMock);

    await expect(requestJson('/api/settings', { timeoutMs: 20 }))
      .rejects.toBeInstanceOf(ApiTimeoutError);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('超时错误可被识别，且带可读文案', async () => {
    vi.stubGlobal('fetch', hangingFetch());

    const error = await requestJson('/api/settings', { timeoutMs: 20 }).catch(e => e);

    expect(error).toBeInstanceOf(ApiTimeoutError);
    expect((error as Error).name).toBe('ApiTimeoutError');
    expect((error as Error).message).toBe('请求超时');
  });

  it('调用方主动取消不会被误判为超时', async () => {
    vi.stubGlobal('fetch', hangingFetch());

    const controller = new AbortController();
    const promise = requestJson('/api/settings', { signal: controller.signal }).catch(e => e);

    controller.abort();
    const error = await promise;

    expect(error).not.toBeInstanceOf(ApiTimeoutError);
    expect((error as Error).name).toBe('AbortError');
  });

  it('默认超时值是合理的有限值', () => {
    expect(LOCAL_REQUEST_TIMEOUT_MS).toBeGreaterThan(0);
    expect(LOCAL_REQUEST_TIMEOUT_MS).toBeLessThanOrEqual(60000);
  });

  it('请求成功后不残留超时定时器', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )));

    await expect(requestJson('/api/health')).resolves.toEqual({ ok: true });

    expect(vi.getTimerCount()).toBe(0);
  });

  it('请求失败后同样不残留超时定时器', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ error: { message: 'boom' } }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )));

    await expect(requestJson('/api/health')).rejects.toThrow('boom');

    expect(vi.getTimerCount()).toBe(0);
  });
});
