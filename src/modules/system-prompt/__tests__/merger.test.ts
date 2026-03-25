import { describe, expect, it } from 'vitest';
import { mergeAdjacentMessages, mergeAllMessages, mergeMessages } from '../core/merger';
import type { ChatMessage } from '@/types';

const sampleMessages: ChatMessage[] = [
  { role: 'system', content: 'A' },
  { role: 'system', content: 'B' },
  { role: 'user', content: 'C' },
  { role: 'assistant', content: 'D' },
  { role: 'assistant', content: 'E' },
];

describe('system-prompt merger', () => {
  it('merges adjacent messages with the same role', () => {
    expect(mergeAdjacentMessages(sampleMessages)).toEqual({
      messages: [
        { role: 'system', content: 'A\n\nB' },
        { role: 'user', content: 'C' },
        { role: 'assistant', content: 'D\n\nE' },
      ],
      mergeCount: 2,
      savedMessages: 2,
    });
  });

  it('merges all messages into one system message', () => {
    expect(mergeAllMessages(sampleMessages)).toEqual({
      messages: [{ role: 'system', content: 'A\n\nB\n\nC\n\nD\n\nE' }],
      mergeCount: 4,
      savedMessages: 4,
    });
  });

  it('honors merge mode selection', () => {
    expect(mergeMessages(sampleMessages, 'none')).toEqual({
      messages: sampleMessages,
      mergeCount: 0,
      savedMessages: 0,
    });
    expect(mergeMessages(sampleMessages, 'adjacent').messages).toHaveLength(3);
    expect(mergeMessages(sampleMessages, 'all').messages).toHaveLength(1);
  });

  it('handles empty input safely', () => {
    expect(mergeAdjacentMessages([])).toEqual({ messages: [], mergeCount: 0, savedMessages: 0 });
    expect(mergeAllMessages([])).toEqual({ messages: [], mergeCount: 0, savedMessages: 0 });
  });
});
