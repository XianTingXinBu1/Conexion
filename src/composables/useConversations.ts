import { ref } from 'vue';
import type { Conversation, Message, AICharacter } from '../types';
import {
  createConversationRecord,
  loadStoredConversations,
  saveStoredConversations,
} from '@/services/conversationRepository';

/**
 * 会话管理 Composable
 * 提供会话的加载、创建、保存、删除等功能
 */
export function useConversations() {
  const conversations = ref<Conversation[]>([]);

  /**
   * 加载所有会话
   */
  const loadAllConversations = async (): Promise<Conversation[]> => {
    const stored = await loadStoredConversations();
    conversations.value = stored;
    return conversations.value;
  };

  /**
   * 保存所有会话
   */
  const saveAllConversations = async (convs: Conversation[]) => {
    conversations.value = convs;
    await saveStoredConversations(convs);
  };

  /**
   * 根据ID获取会话
   */
  const getConversation = (id: string): Conversation | undefined => {
    return conversations.value.find(c => c.id === id);
  };

  /**
   * 创建新会话
   */
  const createConversation = async (
    firstMessage: Message,
    character?: AICharacter
  ): Promise<Conversation> => {
    const conversation = await createConversationRecord(firstMessage, character);

    if (!character) {
      return conversation;
    }

    conversations.value = [...conversations.value, conversation];
    return conversation;
  };

  /**
   * 更新会话
   */
  const updateConversation = async (id: string, updates: Partial<Conversation>): Promise<void> => {
    const index = conversations.value.findIndex(c => c.id === id);
    if (index === -1) {
      return;
    }

    const nextConversation: Conversation = {
      ...conversations.value[index]!,
      ...updates,
      updatedAt: Date.now(),
    };

    conversations.value[index] = nextConversation;
    await saveStoredConversations(conversations.value);
  };

  /**
   * 删除会话
   */
  const deleteConversation = async (id: string): Promise<void> => {
    const nextConversations = conversations.value.filter(c => c.id !== id);

    if (nextConversations.length === conversations.value.length) {
      return;
    }

    conversations.value = nextConversations;
    await saveStoredConversations(nextConversations);
  };

  /**
   * 重命名会话
   */
  const renameConversation = async (id: string, newName: string): Promise<void> => {
    const index = conversations.value.findIndex(c => c.id === id);
    if (index === -1) {
      return;
    }

    conversations.value[index] = {
      ...conversations.value[index]!,
      title: newName,
      updatedAt: Date.now(),
    };
    await saveStoredConversations(conversations.value);
  };

  /**
   * 获取会话预览文本
   */
  const getConversationPreview = (conversation: Conversation): string => {
    if (conversation.messages.length === 0) return '暂无消息';
    const lastMessage = conversation.messages[conversation.messages.length - 1]!;
    return lastMessage.content.slice(0, 50) + (lastMessage.content.length > 50 ? '...' : '');
  };

  /**
   * 刷新会话列表
   */
  const refreshConversations = async (): Promise<void> => {
    await loadAllConversations();
  };

  return {
    conversations,
    loadAllConversations,
    saveAllConversations,
    getConversation,
    createConversation,
    updateConversation,
    deleteConversation,
    renameConversation,
    getConversationPreview,
    refreshConversations,
  };
}