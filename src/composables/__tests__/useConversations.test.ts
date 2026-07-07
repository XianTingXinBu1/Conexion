import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn<typeof fetch>();

function mockJsonResponse(data: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    status: init.status ?? 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...init.headers },
  });
}

describe('useConversations', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('loads all conversations into shared state', async () => {
    const stored = [
      { id: 'conv-1', title: 'Hello', messages: [], createdAt: 1, updatedAt: 2 },
    ];
    fetchMock.mockResolvedValue(mockJsonResponse(stored));

    const { useConversations } = await import('../useConversations');
    const api = useConversations();

    await expect(api.loadAllConversations()).resolves.toEqual(stored);
    expect(api.conversations.value).toEqual(stored);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/conversations');
  });

  it('renames the matching conversation through the backend', async () => {
    const updated = { id: 'conv-1', title: 'New Name', messages: [], createdAt: 1, updatedAt: 3 };
    fetchMock.mockResolvedValue(mockJsonResponse(updated));

    const { useConversations } = await import('../useConversations');
    const api = useConversations();
    api.conversations.value = [
      { id: 'conv-1', title: 'Old', messages: [], createdAt: 1, updatedAt: 2 },
    ];

    await api.renameConversation('conv-1', 'New Name');

    expect(api.conversations.value[0]?.title).toBe('New Name');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/conversations/conv-1');
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe('PATCH');
  });

  it('deletes the matching conversation through the backend', async () => {
    fetchMock.mockResolvedValue(mockJsonResponse({ deleted: true }));

    const { useConversations } = await import('../useConversations');
    const api = useConversations();
    api.conversations.value = [
      { id: 'conv-1', title: 'Keep', messages: [], createdAt: 1, updatedAt: 2 },
      { id: 'conv-2', title: 'Remove', messages: [], createdAt: 1, updatedAt: 3 },
    ];

    await api.deleteConversation('conv-2');

    expect(api.conversations.value).toEqual([
      { id: 'conv-1', title: 'Keep', messages: [], createdAt: 1, updatedAt: 2 },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/conversations/conv-2');
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe('DELETE');
  });
});
