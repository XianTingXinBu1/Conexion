import { ref } from 'vue';
import type { Message } from '@/types';
import {
  applyVariantContent,
  getActiveVariantIndex,
  getMessageVariants,
  resolveSwitchedVariantIndex,
  setActiveVariant,
} from '../application/messageVariants';

interface UseChatMessageActionsOptions {
  messages: { value: Message[] };
  editMessage: (messageId: string, newContent: string) => Promise<boolean>;
  deleteMessage: (messageId: string) => Promise<boolean>;
  saveConversation: () => Promise<void>;
  canSwitchVariant: () => boolean;
  canModifyMessage: () => boolean;
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
    saveConversation,
    showDeleteConfirmDialog,
    confirmDeleteMessage,
    showSuccess,
    showError,
  } = options;

  const isUpdatingMessage = ref(false);
  const editError = ref('');
  const showEditModal = ref(false);
  const editingMessageId = ref('');
  const editingMessageContent = ref('');

  const handleEditMessage = (messageId: string) => {
    if (isUpdatingMessage.value || !options.canModifyMessage()) return;
    editError.value = '';
    const message = messages.value.find(m => m.id === messageId);
    if (!message) return;

    editingMessageId.value = messageId;
    editingMessageContent.value = message.content;
    showEditModal.value = true;
  };

  const handleSaveEdit = async (messageId: string, newContent: string) => {
    if (isUpdatingMessage.value || !options.canModifyMessage()) return;
    editError.value = '';
    if (!newContent.trim()) {
      editError.value = '消息内容不能为空';
      return;
    }
    const message = messages.value.find(m => m.id === messageId);
    if (!message) {
      editError.value = '这条消息已不存在';
      return;
    }

    isUpdatingMessage.value = true;
    try {
      if (!await editMessage(messageId, newContent)) {
        throw new Error('无法保存消息，请重试');
      }
      // 只修改当前版本，其他版本保留。
      applyVariantContent(message, newContent);
      showEditModal.value = false;
      showSuccess('编辑成功', '消息已更新');
    } catch (error) {
      editError.value = error instanceof Error ? error.message : '无法保存消息，请重试';
      showError('编辑失败', editError.value);
    } finally {
      isUpdatingMessage.value = false;
    }
  };

  /**
   * 左右切换 AI 回复的变体。
   *
   * `delta` 为 -1 / +1，环绕切换；切换后立即落库，刷新页面不会跳回原变体。
   * 没有多个变体时是空操作。
   */
  const handleSwitchVariant = async (messageId: string, delta: number) => {
    if (isUpdatingMessage.value || showEditModal.value || !options.canSwitchVariant()) return;

    const message = messages.value.find(m => m.id === messageId);
    if (!message) return;

    const total = getMessageVariants(message).length;
    if (total <= 1) return;

    const nextIndex = resolveSwitchedVariantIndex(getActiveVariantIndex(message), delta, total);
    if (nextIndex === getActiveVariantIndex(message)) return;

    setActiveVariant(message, nextIndex);
    await saveConversation();
  };

  const handleDeleteMessage = (messageId: string) => {
    if (isUpdatingMessage.value || !options.canModifyMessage()) return;
    const message = messages.value.find(m => m.id === messageId);
    if (!message) return;
    const preview = message.content.slice(0, 40);
    const suffix = message.content.length > 40 ? '…' : '';
    showDeleteConfirmDialog(messageId, `「${preview}${suffix}」`, '消息');
  };

  const confirmDelete = async () => {
    const messageId = confirmDeleteMessage();
    if (!messageId || isUpdatingMessage.value || !options.canModifyMessage()) return;
    if (!messages.value.some(message => message.id === messageId)) return;
    isUpdatingMessage.value = true;
    try {
      if (!await deleteMessage(messageId)) throw new Error('无法删除消息，请重试');
      const index = messages.value.findIndex(m => m.id === messageId);
      if (index !== -1) messages.value.splice(index, 1);
      showSuccess('删除成功', '消息及其所有回复版本已删除');
    } catch (error) {
      showError('删除失败', error instanceof Error ? error.message : '无法删除消息，请重试');
    } finally {
      isUpdatingMessage.value = false;
    }
  };

  return {
    isUpdatingMessage,
    editError,
    showEditModal,
    editingMessageId,
    editingMessageContent,
    handleEditMessage,
    handleSaveEdit,
    handleSwitchVariant,
    handleDeleteMessage,
    confirmDelete,
  };
}
