import { describe, expect, it } from 'vitest';
import type { ConversationCompression, Message } from '@/types';
import {
  DEFAULT_COMPRESSION_KEEP_RECENT_MESSAGES,
  getEffectiveConversationTokenCount,
  splitMessagesForCompression,
} from '../index';

const createMessage = (id: string, type: Message['type'], content: string): Message => ({
  id,
  type,
  content,
  timestamp: Number(id),
});

describe('conversationCompression', () => {
  it('keeps only a small recent tail so large older replies can be compressed', () => {
    const messages = [
      createMessage('1', 'user', '你好'),
      createMessage('2', 'assistant', '你好，有什么我可以帮你？'),
      createMessage('3', 'user', '生成一篇长文'),
      createMessage('4', 'assistant', '环境保护很重要。'.repeat(500)),
      createMessage('5', 'user', '在吗'),
      createMessage('6', 'assistant', '在的。'),
      createMessage('7', 'user', '你好'),
      createMessage('8', 'assistant', '你好。'),
    ];

    const { compressibleMessages, retainedMessages } = splitMessagesForCompression(messages);

    expect(DEFAULT_COMPRESSION_KEEP_RECENT_MESSAGES).toBe(2);
    expect(compressibleMessages.map(message => message.id)).toEqual(['1', '2', '3', '4', '5', '6']);
    expect(retainedMessages.map(message => message.id)).toEqual(['7', '8']);
  });

  it('can compress all remaining messages when keepRecentCount is zero', () => {
    const messages = [
      createMessage('1', 'user', '你好'),
      createMessage('2', 'assistant', '你好。'),
    ];

    const { compressibleMessages, retainedMessages } = splitMessagesForCompression(messages, 0);

    expect(compressibleMessages.map(message => message.id)).toEqual(['1', '2']);
    expect(retainedMessages).toEqual([]);
  });

  it('counts compressed source messages as summary plus retained messages', () => {
    const messages = [
      createMessage('1', 'user', '你好'),
      createMessage('2', 'assistant', '你好，有什么我可以帮你？'),
      createMessage('3', 'user', '生成一篇长文'),
      createMessage('4', 'assistant', '环境保护很重要。'.repeat(500)),
      createMessage('5', 'user', '你好'),
      createMessage('6', 'assistant', '你好。'),
    ];
    const uncompressedCount = getEffectiveConversationTokenCount(messages);
    const compression: ConversationCompression = {
      compressedAt: Date.now(),
      summaryContent: '用户要求生成环境保护长文，助手已完成。',
      promptContent: '以下是本会话已压缩的历史摘要：用户要求生成环境保护长文，助手已完成。',
      sourceMessageCount: 4,
      sourceMessageIds: ['1', '2', '3', '4'],
      keepRecentCount: 2,
    };

    expect(getEffectiveConversationTokenCount(messages, compression)).toBeLessThan(uncompressedCount);
  });
});
