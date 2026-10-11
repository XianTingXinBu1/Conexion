import { describe, expect, it } from 'vitest';
import { processChatContent } from '../chatContentPipeline';
import type { RegexRule } from '@/types';
import type { MacroContext } from '@/modules/system-prompt';

const macroContext: MacroContext = {
  aiCharacter: { id: 'ai-1', name: '小助手', description: '', personality: '', createdAt: 0 },
  userCharacter: { id: 'user-1', name: '小明', description: '', createdAt: 0 },
  now: new Date(2026, 6, 8, 13, 9, 45),
};

function rule(overrides: Partial<RegexRule>): RegexRule {
  return {
    id: 'r1',
    name: 'rule',
    enabled: true,
    pattern: '',
    flags: 'g',
    replacement: '',
    scope: 'all',
    applyTo: 'after-macro',
    ...overrides,
  };
}

function process(text: string, rules: RegexRule[] = [], scope: 'user' | 'assistant' = 'user'): string {
  return processChatContent(text, { scope, rules, macroContext });
}

describe('chatContentPipeline', () => {
  it('expands macros in chat content', () => {
    expect(process('你好 {{char}}，现在是 {{date}} {{weekday}}')).toBe('你好 小助手，现在是 2026-07-08 星期三');
  });

  it('keeps unknown macros untouched', () => {
    expect(process('保留 {{unknown}} 原样')).toBe('保留 {{unknown}} 原样');
  });

  it('does not expand macros inside fenced code blocks', () => {
    const text = '示例：\n\n```vue\n<p>{{ char }}</p>\n```\n\n结束';
    expect(process(text)).toBe(text);
  });

  it('does not expand macros inside inline code', () => {
    const text = '在 Vue 里用 `{{ user }}` 插值，而 {{char}} 会被展开';
    expect(process(text)).toBe('在 Vue 里用 `{{ user }}` 插值，而 小助手 会被展开');
  });

  it('runs before-macro rules on the raw text, so macros are still literals', () => {
    const rules = [rule({ pattern: '\\{\\{char\\}\\}', replacement: 'AAA', applyTo: 'before-macro' })];

    // 规则已经把宏吃掉了，后面的宏展开无内容可展开
    expect(process('你好 {{char}}', rules)).toBe('你好 AAA');
  });

  it('runs after-macro rules on expanded text, so they match the resolved value', () => {
    const rules = [rule({ pattern: '小助手', replacement: 'AI', applyTo: 'after-macro' })];

    expect(process('你好 {{char}}', rules)).toBe('你好 AI');
  });

  it('applies each rule exactly once', () => {
    const rules = [
      rule({ id: 'before', pattern: 'X', replacement: '{{char}}', applyTo: 'before-macro' }),
      rule({ id: 'after', pattern: '小助手', replacement: 'AI', applyTo: 'after-macro' }),
    ];

    // before 把 X 换成宏字面量 → 展开成角色名 → after 命中
    expect(process('X', rules)).toBe('AI');
  });

  it('respects rule scope', () => {
    const rules = [rule({ pattern: '你好', replacement: '再见', scope: 'user' })];

    expect(process('你好', rules, 'user')).toBe('再见');
    expect(process('你好', rules, 'assistant')).toBe('你好');
  });

  it('does not expand macros an after-macro rule introduced', () => {
    const rules = [rule({ pattern: 'X', replacement: '{{char}}', applyTo: 'after-macro' })];

    expect(process('X', rules)).toBe('{{char}}');
  });
});
