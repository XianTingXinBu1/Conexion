import { describe, expect, it, vi } from 'vitest';
import { nextTick, ref } from 'vue';
import { useConversationCompression } from '../presentation/useConversationCompression';
import type { ChatMessage, Conversation, Message } from '@/types';

const createMessage = (id: string, type: Message['type'], content: string): Message => ({
  id,
  type,
  content,
  timestamp: Number(id),
});

const toChatMessages = (messages: Message[]): ChatMessage[] => messages.map(message => ({
  role: message.type === 'assistant' ? 'assistant' : 'user',
  content: message.content,
}));

describe('useConversationCompression', () => {
  it('compresses all visible messages for manual compression and saves metadata', async () => {
    const messages = ref<Message[]>([
      createMessage('1', 'user', '主人要求总结任务背景'),
      createMessage('2', 'assistant', '任务背景是模块化压缩上下文'),
      createMessage('3', 'user', '继续保留关键约束'),
    ]);
    const currentConversation = ref<Conversation>({
      id: 'c1',
      title: '压缩测试',
      messages: messages.value,
      createdAt: 1,
      updatedAt: 1,
    });
    const saveConversation = vi.fn(async (_messages: Message[], updates?: Partial<Conversation>) => {
      currentConversation.value = {
        ...currentConversation.value!,
        messages: _messages,
        ...updates,
      };
    });
    const sendChatRequest = vi.fn(async () => '摘要：主人要求模块化压缩上下文，并保留关键约束。');

    const compression = useConversationCompression({
      messages,
      currentConversation,
      saveConversation,
      sendChatRequest,
    });

    const result = await compression.compressConversation({ keepRecentCount: 0 });

    expect(result).toBe(true);
    expect(sendChatRequest).toHaveBeenCalledWith([
      expect.objectContaining({
        role: 'system',
        content: expect.stringContaining('会话压缩助手'),
      }),
      ...toChatMessages(messages.value),
    ]);
    expect(saveConversation).toHaveBeenCalledWith(messages.value, expect.objectContaining({
      compressed: true,
      compression: expect.objectContaining({
        summaryContent: '摘要：主人要求模块化压缩上下文，并保留关键约束。',
        promptContent: expect.stringContaining('已压缩的历史摘要'),
        sourceMessageCount: 3,
        sourceMessageIds: ['1', '2', '3'],
        keepRecentCount: 0,
        contextBeforeCompression: expect.any(Number),
        contextAfterCompression: expect.any(Number),
      }),
    }));
    expect(compression.effectiveMessages.value).toEqual([]);
    expect(compression.compressionSummary.value).toBe('摘要：主人要求模块化压缩上下文，并保留关键约束。');
  });

  it('excludes already compressed source messages on subsequent compression', async () => {
    const messages = ref<Message[]>([
      createMessage('1', 'user', '旧用户消息'),
      createMessage('2', 'assistant', '旧助手消息'),
      createMessage('3', 'user', '新用户消息'),
      createMessage('4', 'assistant', '新助手消息'),
    ]);
    const currentConversation = ref<Conversation>({
      id: 'c1',
      title: '二次压缩测试',
      messages: messages.value,
      compressed: true,
      compression: {
        compressedAt: 1,
        summaryContent: '已有摘要',
        promptContent: '以下是本会话已压缩的历史摘要：\n已有摘要',
        sourceMessageCount: 2,
        sourceMessageIds: ['1', '2'],
        keepRecentCount: 0,
      },
      createdAt: 1,
      updatedAt: 1,
    });
    const saveConversation = vi.fn(async (_messages: Message[], updates?: Partial<Conversation>) => {
      currentConversation.value = {
        ...currentConversation.value!,
        messages: _messages,
        ...updates,
      };
    });
    const sendChatRequest = vi.fn(async () => '合并摘要');

    const compression = useConversationCompression({
      messages,
      currentConversation,
      saveConversation,
      sendChatRequest,
    });
    await nextTick();

    expect(compression.effectiveMessages.value.map(message => message.id)).toEqual(['3', '4']);

    const result = await compression.compressConversation({ keepRecentCount: 0 });

    expect(result).toBe(true);
    expect(sendChatRequest).toHaveBeenCalledWith([
      expect.objectContaining({
        role: 'system',
        content: expect.stringContaining('会话压缩助手'),
      }),
      expect.objectContaining({
        role: 'system',
        content: expect.stringContaining('已有摘要'),
      }),
      ...toChatMessages([messages.value[2]!, messages.value[3]!]),
    ]);
    expect(currentConversation.value.compression?.sourceMessageIds).toEqual(['1', '2', '3', '4']);
    expect(compression.effectiveMessages.value).toEqual([]);
  });
});
