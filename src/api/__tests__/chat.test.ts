/**
 * 流式请求的失败上报测试。
 *
 * 这里锁定一处此前会误报的行为：流式请求的总超时（timeout）原本产生的是
 * 不带 reason 的 abort，即 AbortError，会被上报成「请求已取消」，与用户
 * 主动取消混为一谈。改为以 ApiTimeoutError 作为 abort reason 之后，
 * 超时才会被如实上报。
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChatApi } from '../chat';

/** fetch 桩：永不响应，仅在 signal 被 abort 时以 abort reason 拒绝。 */
const hangingFetch = () => vi.fn(async (_url: unknown, init: RequestInit) => {
  return new Promise<Response>((_resolve, reject) => {
    init.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
  });
});

const readAll = async (generator: AsyncGenerator<string>) => {
  // 消费生成器以驱动内部逻辑
  for await (const _chunk of generator) { /* noop */ }
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('流式请求的失败原因上报', () => {
  it('总超时上报为「请求超时」，而不是「请求已取消」', async () => {
    vi.stubGlobal('fetch', hangingFetch());

    const api = new ChatApi({ baseURL: 'https://upstream.example.com/v1', timeout: 25 }, 'test-model');
    const onError = vi.fn();

    await expect(readAll(api.sendStreamMessage(
      [{ role: 'user', content: 'hi' }],
      { onError },
    ))).rejects.toThrow('请求超时');

    expect(onError).toHaveBeenCalledWith('请求超时');
  });

  it('用户主动取消仍上报为「请求已取消」', async () => {
    vi.stubGlobal('fetch', hangingFetch());

    const api = new ChatApi({ baseURL: 'https://upstream.example.com/v1', timeout: 5000 }, 'test-model');
    const onError = vi.fn();

    const promise = readAll(api.sendStreamMessage(
      [{ role: 'user', content: 'hi' }],
      { onError },
    )).catch(() => undefined);

    await new Promise(resolve => setTimeout(resolve, 10));
    api.cancelActiveStream();
    await promise;

    expect(onError).toHaveBeenCalledWith('请求已取消');
  });
});
