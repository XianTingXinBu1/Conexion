/**
 * 代理请求体构造。
 *
 * 这里锁定一处此前的静默丢参行为：`/api/chat/completions` 只转发
 * model / messages / temperature / max_tokens / stream 五个字段，
 * 前端新增的任何 [OI] 参数（`top_p`、`stop`、`stream_options` …）
 * 都会被悄悄丢掉。改为「透传 + 本地字段黑名单」后，除本地专用字段外
 * 一律原样转发。
 */
import { describe, expect, it } from 'vitest';
import { buildUpstreamChatBody } from './proxy';

describe('buildUpstreamChatBody', () => {
  it('透传未知的 [OI] 参数', () => {
    const body = buildUpstreamChatBody({
      baseURL: 'https://upstream.example.com/v1',
      apiKey: 'sk-secret',
      model: 'test-model',
      messages: [{ role: 'user', content: 'hi' }],
      temperature: 0.7,
      max_tokens: 2048,
      stream: true,
      top_p: 0.9,
      stop: ['\n\n'],
      stream_options: { include_usage: true },
      frequency_penalty: 0.5,
      seed: 42,
    }, 'test-model');

    expect(body).toMatchObject({
      model: 'test-model',
      temperature: 0.7,
      max_tokens: 2048,
      stream: true,
      top_p: 0.9,
      stop: ['\n\n'],
      stream_options: { include_usage: true },
      frequency_penalty: 0.5,
      seed: 42,
    });
  });

  it('剔除本地专用字段，不把 baseURL / apiKey 泄给上游', () => {
    const body = buildUpstreamChatBody({
      baseURL: 'https://upstream.example.com/v1',
      apiKey: 'sk-secret',
      model: 'test-model',
      messages: [],
    }, 'test-model');

    expect(body).not.toHaveProperty('baseURL');
    expect(body).not.toHaveProperty('apiKey');
    expect(body).toEqual({ model: 'test-model', messages: [] });
  });

  it('model 用校验后的归一值覆盖原始值', () => {
    const body = buildUpstreamChatBody({ model: '  padded-model  ', messages: [] }, 'padded-model');

    expect(body.model).toBe('padded-model');
  });

  it('保留显式传入的 null（透传不改变语义）', () => {
    const body = buildUpstreamChatBody({ model: 'm', messages: [], stop: null }, 'm');

    expect(body.stop).toBeNull();
  });
});
