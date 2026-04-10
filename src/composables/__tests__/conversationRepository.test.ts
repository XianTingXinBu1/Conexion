import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Message } from '@/types';

const getStorageMock = vi.fn();
const setStorageMock = vi.fn();

vi.mock('@/utils/storage', () => ({
  getStorage: getStorageMock,
  setStorage: setStorageMock,
}));

describe('conversationRepository', () => {
  beforeEach(() => {
    getStorageMock.mockReset();
    setStorageMock.mockReset();
  });

  it('creates a temporary conversation without persisting when no character is provided', async () => {
    const { createConversationRecord } = await import('@/services/conversationRepository');
    const firstMessage: Message = { id: 'msg-1', type: 'user', content: 'Hello', timestamp: 1 };

    const conversation = await createConversationRecord(firstMessage);

    expect(conversation.id).toMatch(/^temp-/);
    expect(conversation.title).toBe('临时会话');
    expect(conversation.messages).toEqual([firstMessage]);
    expect(setStorageMock).not.toHaveBeenCalled();
  });

  it('persists a stored conversation when a character is provided', async () => {
    getStorageMock.mockResolvedValue([]);

    const { createConversationRecord } = await import('@/services/conversationRepository');
    const firstMessage: Message = {
      id: 'msg-1',
      type: 'user',
      content: 'A very long opening message that should be truncated in the title',
      timestamp: 1,
    };

    const conversation = await createConversationRecord(firstMessage, {
      id: 'char-1',
      name: 'Assistant',
      description: 'Test assistant',
      personality: 'Helpful',
      createdAt: 1,
    });

    expect(conversation.id).toMatch(/^conv-/);
    expect(conversation.characterId).toBe('char-1');
    expect(setStorageMock).toHaveBeenCalledTimes(1);
    expect(setStorageMock.mock.calls[0]?.[1]).toHaveLength(1);
    expect(setStorageMock.mock.calls[0]?.[1][0].title).toContain('...');
  });

  it('blocks message edits for temporary conversations', async () => {
    const { editConversationMessage } = await import('@/services/conversationRepository');

    const updated = await editConversationMessage('temp-123', 'msg-1', 'Updated');

    expect(updated).toBeUndefined();
    expect(getStorageMock).not.toHaveBeenCalled();
    expect(setStorageMock).not.toHaveBeenCalled();
  });

  it('updates persisted messages through the repository', async () => {
    getStorageMock.mockResolvedValue([
      {
        id: 'conv-1',
        title: 'Test',
        messages: [{ id: 'msg-1', type: 'user', content: 'Old', timestamp: 1 }],
        createdAt: 1,
        updatedAt: 2,
      },
    ]);

    const { editConversationMessage } = await import('@/services/conversationRepository');

    const updated = await editConversationMessage('conv-1', 'msg-1', 'New');

    expect(updated?.messages[0]?.content).toBe('New');
    expect(setStorageMock).toHaveBeenCalledTimes(1);
    expect(setStorageMock.mock.calls[0]?.[1][0].messages[0].content).toBe('New');
  });
});
