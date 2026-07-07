import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import type { Conversation, Message } from '@/types';

const fetchMock = vi.fn<typeof fetch>();

function mockJsonResponse(data: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    status: init.status ?? 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...init.headers },
  });
}

function expectJsonBody(body: BodyInit | null | undefined) {
  expect(typeof body).toBe('string');
  return JSON.parse(body as string) as Record<string, unknown>;
}

describe('conversationRepository', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.restoreAllMocks();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('creates a temporary conversation without calling the backend when no character is provided', async () => {
    const { createConversationRecord } = await import('@/services/conversationRepository');
    const firstMessage: Message = { id: 'msg-1', type: 'user', content: 'Hello', timestamp: 1 };

    const conversation = await createConversationRecord(firstMessage);

    expect(conversation.id).toMatch(/^temp-/);
    expect(conversation.title).toBe('临时会话');
    expect(conversation.messages).toEqual([firstMessage]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('creates a stored conversation through the backend when a character is provided', async () => {
    const storedConversation: Conversation = {
      id: 'conv-1',
      title: 'A very long opening message...',
      characterId: 'char-1',
      characterName: 'Assistant',
      messages: [{ id: 'msg-1', type: 'user', content: 'A very long opening message', timestamp: 1 }],
      createdAt: 1,
      updatedAt: 1,
    };
    fetchMock.mockResolvedValue(mockJsonResponse(storedConversation, { status: 201 }));

    const { createConversationRecord } = await import('@/services/conversationRepository');
    const firstMessage = storedConversation.messages[0]!;

    const conversation = await createConversationRecord(firstMessage, {
      id: 'char-1',
      name: 'Assistant',
      description: 'Test assistant',
      personality: 'Helpful',
      createdAt: 1,
    });

    expect(conversation).toEqual(storedConversation);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/conversations');
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe('POST');
    expect(expectJsonBody(fetchMock.mock.calls[0]?.[1]?.body).firstMessage).toEqual(firstMessage);
  });

  it('blocks message edits for temporary conversations without calling the backend', async () => {
    const { editConversationMessage } = await import('@/services/conversationRepository');

    const updated = await editConversationMessage('temp-123', 'msg-1', 'Updated');

    expect(updated).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('updates persisted messages through the backend repository API', async () => {
    const updatedConversation: Conversation = {
      id: 'conv-1',
      title: 'Test',
      messages: [{ id: 'msg-1', type: 'user', content: 'New', timestamp: 1 }],
      createdAt: 1,
      updatedAt: 2,
    };
    fetchMock.mockResolvedValue(mockJsonResponse(updatedConversation));

    const { editConversationMessage } = await import('@/services/conversationRepository');

    const updated = await editConversationMessage('conv-1', 'msg-1', 'New');

    expect(updated?.messages[0]?.content).toBe('New');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/conversations/conv-1/messages/msg-1');
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe('PATCH');
    expect(expectJsonBody(fetchMock.mock.calls[0]?.[1]?.body).content).toBe('New');
  });

  it('returns undefined when the backend reports a missing conversation', async () => {
    fetchMock.mockResolvedValue(mockJsonResponse({ error: { message: '会话不存在' } }, { status: 404 }));

    const { getStoredConversation } = await import('@/services/conversationRepository');

    await expect(getStoredConversation('conv-missing')).resolves.toBeUndefined();
  });

  it('tracks the persisted conversation id after first creation so later sends update instead of creating again', async () => {
    const firstMessage: Message = {
      id: 'msg-1',
      type: 'user',
      content: 'Hello',
      timestamp: 1,
    };
    const createdConversation: Conversation = {
      id: 'conv-1',
      title: 'Hello',
      characterId: 'char-1',
      characterName: 'Assistant',
      messages: [firstMessage],
      createdAt: 1,
      updatedAt: 1,
    };
    const nextMessages: Message[] = [
      firstMessage,
      { id: 'msg-2', type: 'assistant', content: 'Hi', timestamp: 2 },
    ];
    const updatedConversation = { ...createdConversation, messages: nextMessages, updatedAt: 2 };

    fetchMock
      .mockResolvedValueOnce(mockJsonResponse(createdConversation, { status: 201 }))
      .mockResolvedValueOnce(mockJsonResponse(updatedConversation));

    const { useConversationManager } = await import('@/composables/useConversationManager');
    const emitUpdateConversation = vi.fn();
    const manager = useConversationManager(emitUpdateConversation);

    expect(manager.currentConversation.value).toBeUndefined();
    expect(manager.currentConversationId.value).toBeUndefined();

    const created = await manager.createNewConversation(firstMessage, {
      id: 'char-1',
      name: 'Assistant',
      description: 'Test assistant',
      personality: 'Helpful',
      createdAt: 1,
    });

    expect(created.id).toBe('conv-1');
    expect(manager.currentConversationId.value).toBe(created.id);
    expect(manager.currentConversation.value?.id).toBe(created.id);

    await manager.saveConversation(nextMessages);
    await nextTick();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/conversations/conv-1/messages');
    expect(fetchMock.mock.calls[1]?.[1]?.method).toBe('PUT');
    expect(expectJsonBody(fetchMock.mock.calls[1]?.[1]?.body).messages).toEqual(nextMessages);
    expect(manager.currentConversation.value?.messages).toEqual(nextMessages);
  });
});
