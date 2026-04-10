import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
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
    vi.restoreAllMocks();
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

  it('replaces an existing stored conversation instead of appending a duplicate when ids collide', async () => {
    const existingConversation = {
      id: 'conv-123',
      title: 'Old title',
      characterId: 'char-1',
      characterName: 'Assistant',
      messages: [{ id: 'old-msg', type: 'user', content: 'Old content', timestamp: 1 }],
      createdAt: 123,
      updatedAt: 123,
    };

    getStorageMock.mockResolvedValue([existingConversation]);
    vi.spyOn(Date, 'now').mockReturnValue(123);

    const { createConversationRecord } = await import('@/services/conversationRepository');
    const firstMessage: Message = {
      id: 'msg-1',
      type: 'user',
      content: 'New content',
      timestamp: 123,
    };

    const conversation = await createConversationRecord(firstMessage, {
      id: 'char-1',
      name: 'Assistant',
      description: 'Test assistant',
      personality: 'Helpful',
      createdAt: 1,
    });

    expect(conversation.id).toBe('conv-123');
    expect(setStorageMock).toHaveBeenCalledTimes(1);
    expect(setStorageMock.mock.calls[0]?.[1]).toHaveLength(1);
    expect(setStorageMock.mock.calls[0]?.[1][0]).toMatchObject({
      id: 'conv-123',
      title: 'New content',
      messages: [firstMessage],
    });
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

  it('tracks the persisted conversation id after first creation so later sends update instead of creating again', async () => {
    getStorageMock.mockResolvedValue([]);

    const { useConversationManager } = await import('@/composables/useConversationManager');
    const emitUpdateConversation = vi.fn();
    const manager = useConversationManager(emitUpdateConversation);

    expect(manager.currentConversation.value).toBeUndefined();
    expect(manager.currentConversationId.value).toBeUndefined();

    const firstMessage: Message = {
      id: 'msg-1',
      type: 'user',
      content: 'Hello',
      timestamp: 1,
    };

    const created = await manager.createNewConversation(firstMessage, {
      id: 'char-1',
      name: 'Assistant',
      description: 'Test assistant',
      personality: 'Helpful',
      createdAt: 1,
    });

    expect(created.id).toMatch(/^conv-/);
    expect(manager.currentConversationId.value).toBe(created.id);
    expect(manager.currentConversation.value?.id).toBe(created.id);

    const nextMessages: Message[] = [
      firstMessage,
      { id: 'msg-2', type: 'assistant', content: 'Hi', timestamp: 2 },
    ];

    await manager.saveConversation(nextMessages);
    await nextTick();

    expect(setStorageMock).toHaveBeenCalledTimes(2);
    expect(setStorageMock.mock.calls[1]?.[1]).toHaveLength(1);
    expect(setStorageMock.mock.calls[1]?.[1][0]).toMatchObject({
      id: created.id,
      messages: nextMessages,
    });
  });
});
