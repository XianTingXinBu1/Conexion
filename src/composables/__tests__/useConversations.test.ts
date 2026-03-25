import { beforeEach, describe, expect, it, vi } from 'vitest';

const getStorageMock = vi.fn();
const setStorageMock = vi.fn();

vi.mock('@/utils/storage', () => ({
  getStorage: getStorageMock,
  setStorage: setStorageMock,
}));

describe('useConversations', () => {
  beforeEach(() => {
    getStorageMock.mockReset();
    setStorageMock.mockReset();
  });

  it('loads all conversations into shared state', async () => {
    const stored = [
      { id: 'conv-1', title: 'Hello', messages: [], createdAt: 1, updatedAt: 2 },
    ];
    getStorageMock.mockResolvedValue(stored);

    const { useConversations } = await import('../useConversations');
    const api = useConversations();

    await expect(api.loadAllConversations()).resolves.toEqual(stored);
    expect(api.conversations.value).toEqual(stored);
  });

  it('renames and persists the matching conversation', async () => {
    const { useConversations } = await import('../useConversations');
    const api = useConversations();
    api.conversations.value = [
      { id: 'conv-1', title: 'Old', messages: [], createdAt: 1, updatedAt: 2 },
    ];

    await api.renameConversation('conv-1', 'New Name');

    expect(api.conversations.value[0]?.title).toBe('New Name');
    expect(setStorageMock).toHaveBeenCalledTimes(1);
    expect(setStorageMock.mock.calls[0]?.[1][0].title).toBe('New Name');
  });

  it('deletes and persists the filtered conversation list', async () => {
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
    expect(setStorageMock).toHaveBeenCalledTimes(1);
    expect(setStorageMock.mock.calls[0]?.[1]).toHaveLength(1);
  });
});
