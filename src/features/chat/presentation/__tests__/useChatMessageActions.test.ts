import { ref } from 'vue';
import { describe, it, expect, vi } from 'vitest';
import { useChatMessageActions } from '../useChatMessageActions';
import type { Message } from '@/types';

function setup() {
  const messages = ref<Message[]>(['a', 'b', 'c', 'd'].map(id => ({ id, type: 'user', content: id, timestamp: 1 })));
  const deleteMessage = vi.fn(async () => true);
  const showDeleteConfirmDialog = vi.fn();
  const showError = vi.fn();
  const actions = useChatMessageActions({ messages, deleteMessage, editMessage: vi.fn(async () => true), saveConversation: vi.fn(), canSwitchVariant: () => true, canModifyMessage: () => true, showDeleteConfirmDialog, confirmDeleteMessage: () => 'selected-messages', showSuccess: vi.fn(), showError });
  return { messages, deleteMessage, showDeleteConfirmDialog, showError, ...actions };
}

describe('message deletion selection', () => {
  it('selects the clicked message and all later messages without deleting immediately', () => {
    const state = setup();
    state.handleDeleteMessage('b');
    expect(state.isSelectingMessages.value).toBe(true);
    expect(state.selectedMessageIds.value).toEqual(['b', 'c', 'd']);
    expect(state.deleteMessage).not.toHaveBeenCalled();
    expect(state.showDeleteConfirmDialog).not.toHaveBeenCalled();
    state.cancelMessageSelection();
    expect(state.messages.value).toHaveLength(4);
    expect(state.selectedMessageCount.value).toBe(0);
  });

  it('deletes only checked messages after confirmation', async () => {
    const state = setup();
    state.handleDeleteMessage('b');
    state.toggleMessageSelection('c');
    state.requestDeleteSelected();
    expect(state.showDeleteConfirmDialog).toHaveBeenCalled();
    await state.confirmDelete();
    expect(state.messages.value.map(message => message.id)).toEqual(['a', 'c']);
    expect(state.isSelectingMessages.value).toBe(false);
  });

  it('preserves remaining selections when a request fails midway', async () => {
    const state = setup();
    state.deleteMessage.mockResolvedValueOnce(true).mockRejectedValueOnce(new Error('offline'));
    state.handleDeleteMessage('b');
    await state.confirmDelete();
    expect(state.messages.value.map(message => message.id)).toEqual(['a', 'c', 'd']);
    expect(state.selectedMessageIds.value).toEqual(['c', 'd']);
    expect(state.showError).toHaveBeenCalled();
    expect(state.isUpdatingMessage.value).toBe(false);
  });
});
