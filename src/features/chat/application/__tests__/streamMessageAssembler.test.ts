import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StreamMessageAssembler } from '../streamMessageAssembler';
import type { RegexRule } from '@/types';

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
      onFlush: (content) => flushed.push(content),
    });

    assembler.append('hello');
    expect(assembler.finalize()).toBe('hello');
    expect(flushed).toEqual(['hello']);
  });
});
