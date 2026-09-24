import { describe, expect, it } from 'vitest';
import { applyMacros, buildMacroValues, renderMacros } from '../core/macro';
import { fillItemContent } from '../core/content-filler';
import type { AICharacter, PromptItem, UserCharacter } from '@/types';

const now = 1_700_000_000_000;

const aiCharacter: AICharacter = {
  id: 'ai-1',
  name: '小助手',
  description: '负责回答问题',
  personality: '友好、简洁',
  createdAt: now,
};

const userCharacter: UserCharacter = {
  id: 'user-1',
  name: '小明',
  description: '喜欢科幻的测试用户',
  createdAt: now,
};

function item(overrides: Partial<PromptItem>): PromptItem {
  return {
    id: 'custom',
    name: '主提示词',
    description: '',
    enabled: true,
    prompt: '',
    roleType: 'system',
    ...overrides,
  };
}

describe('system-prompt macros', () => {
  it('resolves all supported variables from characters', () => {
    const values = buildMacroValues({ aiCharacter, userCharacter });

    expect(values.char).toBe('小助手');
    expect(values.charname).toBe('小助手');
    expect(values.user).toBe('小明');
    expect(values.username).toBe('小明');
    expect(values.description).toBe('负责回答问题');
    expect(values.personality).toBe('友好、简洁');
    expect(values.user_description).toBe('喜欢科幻的测试用户');
  });

  it('replaces macros regardless of spacing and case', () => {
    const text = '你是{{ char }}，用户是{{USER}}，身份：{{Char}}';
    const rendered = renderMacros(text, { aiCharacter, userCharacter });

    expect(rendered).toBe('你是小助手，用户是小明，身份：小助手');
  });

  it('keeps unknown variables untouched', () => {
    const rendered = renderMacros('保留 {{unknown}} 原样', { aiCharacter, userCharacter });
    expect(rendered).toBe('保留 {{unknown}} 原样');
  });

  it('supports real-time time macros from injected now', () => {
    const fixed = new Date(2026, 6, 8, 13, 9, 45); // 2026-07-08 13:09:45 周三
    const values = buildMacroValues({ aiCharacter, userCharacter, now: fixed });

    expect(values.date).toBe('2026-07-08');
    expect(values.time).toBe('2026-07-08 13:09:45');
    expect(values.hour).toBe('13');
    expect(values.weekday).toBe('星期三');
  });

  it('applies macros to custom prompt content in fillItemContent', () => {
    const result = fillItemContent(
      item({ prompt: '你是{{char}}，请服务好{{user}}。当前时间：{{date}}' }),
      { aiCharacter, userCharacter, now: new Date(2026, 6, 8, 13, 9, 45) },
    );

    expect(result.placeholder).toBeNull();
    expect(result.content).toBe('你是小助手，请服务好小明。当前时间：2026-07-08');
  });

  it('still fills character slot when prompt is empty', () => {
    const result = fillItemContent(
      item({ id: 'character-setting', name: '角色设定', prompt: '' }),
      { aiCharacter, userCharacter },
    );

    expect(result.placeholder).toBe('character');
    expect(result.content).toContain('小助手');
    expect(result.content).toContain('友好、简洁');
  });

  it('does not crash when characters are missing', () => {
    const rendered = renderMacros('名字：{{char}}，用户：{{user}}', {});
    expect(rendered).toBe('名字：，用户：');
  });

  it('returns text unchanged when it has no macros', () => {
    const text = '普通文本 without braces';
    expect(applyMacros(text, buildMacroValues({ aiCharacter }))).toBe(text);
  });
});
