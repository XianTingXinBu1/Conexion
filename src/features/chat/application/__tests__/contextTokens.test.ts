import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '@/types';
import { countMessagesTokens } from '@/utils/tokenCounter';
import { resolveContextTokens, type ContextTokenBaseline } from '../contextTokens';

const input: ChatMessage[] = [{ role: 'system', content: '角色设定' }, { role: 'user', content: '你好' }];
const baseline: ContextTokenBaseline = { model: 'deepseek-flash', baseURL: 'https://api.example.com', messages: input, promptTokens: 100 };
const resolve = (messages: ChatMessage[], value: ContextTokenBaseline | null = baseline) =>
  resolveContextTokens(messages, value, baseline.model, baseline.baseURL);

describe('contextTokens', () => {
  it('相同请求以 API 实际输入为准，不使用本地估算覆盖', () => {
    expect(resolve(input)).toEqual({ tokens: 100, source: 'api' });
  });
  it('下一轮只估算新增内容，输出总用量不参与上下文统计', () => {
    const reply: ChatMessage = { role: 'assistant', content: '你好！' };
    expect(resolve([...input, reply])).toEqual({
      tokens: 100 + countMessagesTokens([reply]), source: 'api-with-estimate',
    });
  });
  it('编辑、删除、压缩改变已测量输入时退回完整估算', () => {
    for (const changed of [input.slice(0, 1), [{ role: 'user' as const, content: '修改' }],
      [{ role: 'system' as const, content: '压缩摘要' }, input[1]!]]) {
      expect(resolve(changed)).toEqual({ tokens: countMessagesTokens(changed), source: 'estimate' });
    }
  });
  it('更换模型或服务地址不能复用旧实际值', () => {
    expect(resolveContextTokens(input, baseline, 'other', baseline.baseURL).source).toBe('estimate');
    expect(resolveContextTokens(input, baseline, baseline.model, 'https://other.example.com').source).toBe('estimate');
  });
  it('无用量和无效用量都回退本地估算，实际零输入合法', () => {
    expect(resolve(input, null).source).toBe('estimate');
    expect(resolve(input, { ...baseline, promptTokens: NaN }).source).toBe('estimate');
    expect(resolve(input, { ...baseline, promptTokens: 0 })).toEqual({ tokens: 0, source: 'api' });
  });
});
