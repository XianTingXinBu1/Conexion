import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StreamMessageAssembler } from '../streamMessageAssembler';
import type { RegexRule } from '@/types';
import type { MacroContext } from '@/modules/system-prompt';

const macroContext: MacroContext = {
  aiCharacter: { id: 'ai-1', name: '小助手', description: '', personality: '', createdAt: 0 },
  userCharacter: { id: 'user-1', name: '小明', description: '', createdAt: 0 },
  now: new Date(2026, 6, 8, 13, 9, 45),
};

describe('StreamMessageAssembler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('flushes streamed chunks and applies assistant regex to raw content', async () => {
    const rules: RegexRule[] = [
      {
        id: 'r1',
        name: 'duplicate a',
        enabled: true,
        pattern: 'a',
        flags: 'g',
        replacement: 'aa',
        scope: 'assistant',
        applyTo: 'after-macro',
      },
    ];
    const flushed: string[] = [];

    const assembler = new StreamMessageAssembler({
      flushIntervalMs: 50,
      getRegexRules: () => rules,
      macroContext,
      onFlush: (content) => flushed.push(content),
    });

    assembler.append('a');
    await vi.advanceTimersByTimeAsync(60);
    assembler.append('a');
    await vi.advanceTimersByTimeAsync(60);

    expect(flushed).toEqual(['aa', 'aaaa']);
  });

  it('finalize synchronously flushes pending content', () => {
    const flushed: string[] = [];
    const assembler = new StreamMessageAssembler({
      flushIntervalMs: 50,
      getRegexRules: () => [],
      macroContext,
      onFlush: (content) => flushed.push(content),
    });

    assembler.append('hello');
    expect(assembler.finalize()).toBe('hello');
    expect(flushed).toEqual(['hello']);
  });

  it('expands macros in streamed assistant output but not inside code', async () => {
    const flushed: string[] = [];
    const assembler = new StreamMessageAssembler({
      flushIntervalMs: 50,
      getRegexRules: () => [],
      macroContext,
      onFlush: (content) => flushed.push(content),
    });

    assembler.append('我是 {{char}}，代码里的 `{{ user }}` 保持原样');
    await vi.advanceTimersByTimeAsync(60);

    expect(flushed).toEqual(['我是 小助手，代码里的 `{{ user }}` 保持原样']);
  });
});
