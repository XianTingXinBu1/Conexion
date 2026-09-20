/**
 * API 层共享错误处理的测试。
 *
 * 这里锁定三件事：
 * 1. 错误体解析只有一份实现，且兼容 { error: { message } } 与 { message }
 * 2. ApiRequestError 能携带 status / serverMessage，供调用方做程序化判断
 * 3. requestJson 在非 2xx 时把后端消息原样放进 error.message 与
 *    error.serverMessage——本地数据接口的调用方依赖 serverMessage 做语义判断
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiRequestError, extractApiErrorMessage, parseApiErrorMessage } from '../errors';
import { requestJson } from '../http';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('extractApiErrorMessage', () => {
  it('读取 { error: { message } }', () => {
    expect(extractApiErrorMessage({ error: { message: '会话不存在' } })).toBe('会话不存在');
  });

  it('读取 { message }', () => {
    expect(extractApiErrorMessage({ message: '简洁消息' })).toBe('简洁消息');
  });

  it('两个字段同时存在时优先 error.message', () => {
    expect(extractApiErrorMessage({ error: { message: '优先' }, message: '其次' })).toBe('优先');
  });

  it('无法识别时返回 undefined', () => {
    expect(extractApiErrorMessage(null)).toBeUndefined();
    expect(extractApiErrorMessage('字符串')).toBeUndefined();
    expect(extractApiErrorMessage({ error: { message: 123 } })).toBeUndefined();
    expect(extractApiErrorMessage({ error: { message: '   ' } })).toBeUndefined();
    expect(extractApiErrorMessage({})).toBeUndefined();
  });
});

describe('parseApiErrorMessage', () => {
  it('解析 JSON 响应体', () => {
    expect(parseApiErrorMessage('{"error":{"message":"boom"}}')).toBe('boom');
  });

  it('非 JSON 响应体时把原文当作消息', () => {
    expect(parseApiErrorMessage('  Bad Gateway  ')).toBe('Bad Gateway');
  });

  it('空响应体返回 undefined', () => {
    expect(parseApiErrorMessage('   ')).toBeUndefined();
  });
});

describe('ApiRequestError', () => {
  it('携带 status 与 serverMessage，且 instanceof Error', () => {
    const error = new ApiRequestError('API 请求失败 (404): 没了', {
      status: 404,
      serverMessage: '没了',
    });

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('ApiRequestError');
    expect(error.status).toBe(404);
    expect(error.serverMessage).toBe('没了');
    expect(error.message).toBe('API 请求失败 (404): 没了');
  });
});

describe('requestJson 的错误契约', () => {
  it('非 2xx 时 message 等于后端原始消息（供语义判断）', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ error: { message: '会话不存在' } }),
      { status: 404, headers: { 'Content-Type': 'application/json' } },
    )));

    await expect(requestJson('/api/conversations/nope')).rejects.toMatchObject({
      message: '会话不存在',
      status: 404,
      serverMessage: '会话不存在',
    });
  });

  it('响应体不是 JSON 时回退到状态码文案', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      '<html>502 Bad Gateway</html>',
      { status: 502, headers: { 'Content-Type': 'text/html' } },
    )));

    await expect(requestJson('/api/conversations')).rejects.toMatchObject({
      message: '请求失败 (502)',
      status: 502,
    });
  });

  it('2xx 时正常返回解析后的 JSON', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )));

    await expect(requestJson('/api/health')).resolves.toEqual({ ok: true });
  });
});
