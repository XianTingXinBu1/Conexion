import { ref } from 'vue';
import type { Message } from '../types';

interface UseChatMessageActionsOptions {
  messages: { value: Message[] };
  editMessage: (messageId: string, newContent: string) => Promise<boolean>;
  deleteMessage: (messageId: string) => Promise<boolean>;
  showDeleteConfirmDialog: (messageId: string, title: string, targetName?: string) => void;
  confirmDeleteMessage: () => string | null;
  showSuccess: (title: string, message?: string) => void;
  showError: (title: string, message?: string) => void;
}

export function useChatMessageActions(options: UseChatMessageActionsOptions) {
  const {
    messages,
    editMessage,
    deleteMessage,
    showDeleteConfirmDialog,
    confirmDeleteMessage,
    showSuccess,
    showError,
  } = options;

  const showEditModal = ref(false);
  const editingMessageId = ref('');
  const editingMessageContent = ref('');

  const handleEditMessage = (messageId: string) => {
    const message = messages.value.find(m => m.id === messageId);
    if (!message) return;

    editingMessageId.value = messageId;
    editingMessageContent.value = message.content;
    showEditModal.value = true;
  };

  const handleSaveEdit = async (messageId: string, newContent: string) => {
    const success = await editMessage(messageId, newContent);
    if (success) {
      const message = messages.value.find(m => m.id === messageId);
      if (message) {
        message.content = newContent;
      }
      showSuccess('编辑成功', '消息已更新');
      return;
    }

    showError('编辑失败', '无法编辑临时会话的消息');
  };

  const handleDeleteMessage = (messageId: string) => {
    const message = messages.value.find(m => m.id === messageId);
    if (!message) return;

    showDeleteConfirmDialog(messageId, `消息 #${message.content.slice(0, 20)}...`, '这条消息');
  };

  const confirmDelete = async () => {
    const messageId = confirmDeleteMessage();
    if (!messageId) return;

    const success = await deleteMessage(messageId);
    if (success) {
      const index = messages.value.findIndex(m => m.id === messageId);
      if (index !== -1) {
        messages.value.splice(index, 1);
      }
      showSuccess('删除成功', '消息已删除');
      return;
    }

    showError('删除失败', '无法删除临时会话的消息');
  };

  return {
    showEditModal,
    editingMessageId,
    editingMessageContent,
    handleEditMessage,
    handleSaveEdit,
    handleDeleteMessage,
    confirmDelete,
  };
}
