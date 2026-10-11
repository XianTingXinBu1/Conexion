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

/** 构造一个能拿到请求体的 fetch 桩。 */
const captureFetch = (body: string) => vi.fn(async () => new Response(body, {
  status: 200,
  headers: { 'Content-Type': 'application/json' },
}));

const readRequestBody = (fetchStub: ReturnType<typeof vi.fn>): Record<string, unknown> => {
  const init = fetchStub.mock.calls[0]?.[1] as RequestInit;
  return JSON.parse(String(init.body)) as Record<string, unknown>;
};

/**
 * 请求体形状。
 *
 * `stream_options.include_usage` 是 [OI] 规范里请求流式 usage 的唯一手段：
 * 不传时上游可以自行决定是否在最后一个 chunk 里带 usage，Token 面板就会时有时无。
 */
describe('请求体形状', () => {
  it('流式请求带上 stream_options.include_usage', async () => {
    const fetchStub = captureFetch('data: [DONE]\n\n');
    vi.stubGlobal('fetch', fetchStub);

    const api = new ChatApi({ baseURL: 'https://upstream.example.com/v1', timeout: 5000 }, 'test-model');
    await readAll(api.sendStreamMessage([{ role: 'user', content: 'hi' }], {}));

    const body = readRequestBody(fetchStub);
    expect(body.stream).toBe(true);
    expect(body.stream_options).toEqual({ include_usage: true });
  });

  it('非流式请求不带 stream_options', async () => {
    const fetchStub = captureFetch(JSON.stringify({
      choices: [{ index: 0, message: { role: 'assistant', content: 'hi' } }],
    }));
    vi.stubGlobal('fetch', fetchStub);

    const api = new ChatApi({ baseURL: 'https://upstream.example.com/v1', timeout: 5000 }, 'test-model');
    await api.sendMessage([{ role: 'user', content: 'hi' }], {});

    const body = readRequestBody(fetchStub);
    expect(body.stream).toBe(false);
    expect(body).not.toHaveProperty('stream_options');
  });
});

/**
 * 采样参数映射。
 *
 * 预设里是 camelCase，发出去要按 [OI] 的 snake_case；两处容易踩的坑：
 * 空的 `stop` 不该发（部分上游会直接报错），未设 `seed` 必须省略
 * （发 `0` 是「固定种子」，会让每次输出都一样）。
 */
describe('采样参数映射', () => {
  const successBody = JSON.stringify({
    choices: [{ index: 0, message: { role: 'assistant', content: 'hi' } }],
  });

  it('把 topP / 惩罚系数映射成 [OI] 字段名，并总是发送', async () => {
    const fetchStub = captureFetch(successBody);
    vi.stubGlobal('fetch', fetchStub);

    const api = new ChatApi({ baseURL: 'https://upstream.example.com/v1', timeout: 5000 }, 'test-model');
    await api.sendMessage([{ role: 'user', content: 'hi' }], {
      topP: 0.9,
      frequencyPenalty: 0.3,
      presencePenalty: -0.2,
    });

    const body = readRequestBody(fetchStub);
    expect(body.top_p).toBe(0.9);
    expect(body.frequency_penalty).toBe(0.3);
    expect(body.presence_penalty).toBe(-0.2);
  });

  it('未传采样参数时发 [OI] 默认值，而不是省略字段', async () => {
    const fetchStub = captureFetch(successBody);
    vi.stubGlobal('fetch', fetchStub);

    const api = new ChatApi({ baseURL: 'https://upstream.example.com/v1', timeout: 5000 }, 'test-model');
    await api.sendMessage([{ role: 'user', content: 'hi' }], {});

    const body = readRequestBody(fetchStub);
    expect(body.top_p).toBe(1);
    expect(body.frequency_penalty).toBe(0);
    expect(body.presence_penalty).toBe(0);
  });

  it('stop 非空时发送，空数组或未传时省略该字段', async () => {
    const fetchStub = captureFetch(successBody);
    vi.stubGlobal('fetch', fetchStub);

    const api = new ChatApi({ baseURL: 'https://upstream.example.com/v1', timeout: 5000 }, 'test-model');
    await api.sendMessage([{ role: 'user', content: 'hi' }], { stopSequences: ['\n\nUser:', '###'] });
    expect(readRequestBody(fetchStub).stop).toEqual(['\n\nUser:', '###']);

    fetchStub.mockClear();
    await api.sendMessage([{ role: 'user', content: 'hi' }], { stopSequences: [] });
    expect(readRequestBody(fetchStub)).not.toHaveProperty('stop');

    fetchStub.mockClear();
    await api.sendMessage([{ role: 'user', content: 'hi' }], {});
    expect(readRequestBody(fetchStub)).not.toHaveProperty('stop');
  });

  it('seed 设置时发送，未设置时省略（省略才是「每次随机」）', async () => {
    const fetchStub = captureFetch(successBody);
    vi.stubGlobal('fetch', fetchStub);

    const api = new ChatApi({ baseURL: 'https://upstream.example.com/v1', timeout: 5000 }, 'test-model');
    await api.sendMessage([{ role: 'user', content: 'hi' }], { seed: 42 });
    expect(readRequestBody(fetchStub).seed).toBe(42);

    fetchStub.mockClear();
    await api.sendMessage([{ role: 'user', content: 'hi' }], {});
    expect(readRequestBody(fetchStub)).not.toHaveProperty('seed');
  });

  it('流式路径也带上同一套采样参数', async () => {
    const fetchStub = captureFetch('data: [DONE]\n\n');
    vi.stubGlobal('fetch', fetchStub);

    const api = new ChatApi({ baseURL: 'https://upstream.example.com/v1', timeout: 5000 }, 'test-model');
    await readAll(api.sendStreamMessage([{ role: 'user', content: 'hi' }], {
      topP: 0.5,
      frequencyPenalty: 1,
      presencePenalty: 1,
      stopSequences: ['STOP'],
      seed: 7,
    }));

    const body = readRequestBody(fetchStub);
    expect(body.top_p).toBe(0.5);
    expect(body.frequency_penalty).toBe(1);
    expect(body.presence_penalty).toBe(1);
    expect(body.stop).toEqual(['STOP']);
    expect(body.seed).toBe(7);
    expect(body.stream_options).toEqual({ include_usage: true });
  });
});
