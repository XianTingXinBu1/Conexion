import { describe, expect, it } from 'vitest';
import { buildGreetingMessage, listGreetings } from '../buildGreetingMessage.usecase';
import type { AICharacter, RegexRule, UserCharacter } from '@/types';

const now = new Date(2026, 6, 8, 13, 9, 45);

const userCharacter: UserCharacter = {
  id: 'user-1',
  name: '小明',
  description: '测试用户',
  createdAt: 0,
};

function character(overrides: Partial<AICharacter> = {}): AICharacter {
  return {
    id: 'ai-1',
    name: '小助手',
    description: '负责回答问题',
    personality: '友好',
    createdAt: 0,
    ...overrides,
  };
}

function rule(overrides: Partial<RegexRule>): RegexRule {
  return {
    id: 'r1',
    name: 'rule',
    enabled: true,
    pattern: '',
    flags: 'g',
    replacement: '',
    scope: 'assistant',
    applyTo: 'after-macro',
    ...overrides,
  };
}

describe('listGreetings', () => {
  it('puts firstMessage before alternates and drops empties', () => {
    const greetings = listGreetings(character({
      firstMessage: '一',
      alternateGreetings: ['二', '', '  ', '三'],
    }));

    expect(greetings).toEqual(['一', '二', '三']);
  });

  it('returns an empty list without a character or greetings', () => {
    expect(listGreetings(undefined)).toEqual([]);
    expect(listGreetings(character())).toEqual([]);
  });
});

describe('buildGreetingMessage', () => {
  it('expands macros with the character and selected user', () => {
    const message = buildGreetingMessage({
      character: character({ firstMessage: '我是{{char}}，你是{{user}}，现在是{{date}}' }),
      userCharacter,
      now,
    });

    expect(message).toEqual({
      id: `greeting-${now.getTime()}`,
      type: 'assistant',
      content: '我是小助手，你是小明，现在是2026-07-08',
      timestamp: now.getTime(),
    });
  });

  it('falls back to the first alternate when firstMessage is empty', () => {
    const message = buildGreetingMessage({
      character: character({ alternateGreetings: ['备选一', '备选二'] }),
      now,
    });

    expect(message?.content).toBe('备选一');
  });

  it('selects the requested greeting index', () => {
    const target = character({ firstMessage: '一', alternateGreetings: ['二', '三'] });

    expect(buildGreetingMessage({ character: target, now, greetingIndex: 0 })?.content).toBe('一');
    expect(buildGreetingMessage({ character: target, now, greetingIndex: 2 })?.content).toBe('三');
    expect(buildGreetingMessage({ character: target, now, greetingIndex: 9 })).toBeNull();
  });

  it('returns null when there is no greeting', () => {
    expect(buildGreetingMessage({ character: character(), now })).toBeNull();
    expect(buildGreetingMessage({ now })).toBeNull();
  });

  it('runs the assistant pipeline, so before/after macro timing applies', () => {
    const rules = [
      rule({ id: 'before', pattern: '\\{\\{char\\}\\}', replacement: '字面量', applyTo: 'before-macro' }),
      rule({ id: 'after', pattern: '小助手', replacement: 'AI', applyTo: 'after-macro' }),
    ];

    const message = buildGreetingMessage({
      character: character({ firstMessage: '我是{{char}}' }),
      rules,
      now,
    });

    // before-macro 规则先吃掉宏，后面的展开与 after-macro 规则都不再命中
    expect(message?.content).toBe('我是字面量');
  });

  it('does not expand macros inside code regions', () => {
    const message = buildGreetingMessage({
      character: character({ firstMessage: '看这段 `{{char}}`，而我是{{char}}' }),
      now,
    });

    expect(message?.content).toBe('看这段 `{{char}}`，而我是小助手');
  });
});
