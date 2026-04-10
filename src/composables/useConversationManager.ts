import { ref } from 'vue';
import type { Message, Conversation, AICharacter } from '../types';
import {
  createConversationRecord,
  deleteConversationMessage,
  editConversationMessage,
  getStoredConversation,
  isTemporaryConversationId,
  updateConversationMessages,
} from '@/services/conversationRepository';

export function useConversationManager(
  emitUpdateConversation: (conversation: Conversation) => void
) {
  const currentConversationId = ref<string | undefined>(undefined);
  const currentConversation = ref<Conversation | undefined>(undefined);

  /**
   * 加载会话
   */
  const loadConversation = async (id: string | undefined): Promise<Message[]> => {
    currentConversationId.value = id;

    if (!id) {
      // 临时会话：重置状态
      currentConversation.value = undefined;
      return [];
    }

    const conversation = await getStoredConversation(id);
    if (conversation) {
      currentConversation.value = conversation;
      return conversation.messages;
    } else {
      currentConversation.value = undefined;
      return [];
    }
  };

  /**
   * 创建新会话
   */
  const createNewConversation = async (firstMessage: Message, character?: AICharacter): Promise<Conversation> => {
    const newConversation = await createConversationRecord(firstMessage, character);

    currentConversationId.value = newConversation.id;
    currentConversation.value = newConversation;

    if (character) {
      emitUpdateConversation(newConversation);
    }

    return newConversation;
  };

  /**
   * 保存会话
   */
  const saveConversation = async (messages: Message[]) => {
    if (!currentConversationId.value || messages.length === 0) {
      return;
    }

    // 临时会话不保存
    if (isTemporaryConversationId(currentConversationId.value)) {
      return;
    }

    const updated = await updateConversationMessages(currentConversationId.value, messages);

    if (updated) {
      currentConversation.value = updated;
      emitUpdateConversation(updated);
    }
  };

  /**
   * 获取当前会话
   */
  const getCurrentConversation = (): Conversation | undefined => {
    return currentConversation.value;
  };

  /**
   * 获取当前会话ID
   */
  const getCurrentConversationId = (): string | undefined => {
    return currentConversationId.value;
  };

  /**
   * 设置当前会话ID（用于外部控制）
   */
  const setCurrentConversationId = (id: string | undefined) => {
    currentConversationId.value = id;
  };

  /**
   * 编辑消息
   */
  const editMessage = async (messageId: string, newContent: string): Promise<boolean> => {
    if (!currentConversationId.value) {
      return false;
    }

    const updated = await editConversationMessage(currentConversationId.value, messageId, newContent);

    if (!updated) {
      return false;
    }

    currentConversation.value = updated;
    emitUpdateConversation(updated);

    return true;
  };

  /**
   * 删除消息
   */
  const deleteMessage = async (messageId: string): Promise<boolean> => {
    if (!currentConversationId.value) {
      return false;
    }

    const updated = await deleteConversationMessage(currentConversationId.value, messageId);

    if (!updated) {
      return false;
    }

    currentConversation.value = updated;
    emitUpdateConversation(updated);

    return true;
  };

  return {
    currentConversationId,
    currentConversation,
    loadConversation,
    createNewConversation,
    saveConversation,
    getCurrentConversation,
    getCurrentConversationId,
    setCurrentConversationId,
    editMessage,
    deleteMessage,
  };
}