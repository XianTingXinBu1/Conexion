import { ref } from 'vue';
import type { Conversation, Message, AICharacter } from '../types';
import { STORAGE_KEYS } from '../constants';
import { getStorage, setStorage } from '@/utils/storage';

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
    const stored = await getStorage<Conversation[]>(STORAGE_KEYS.CONVERSATIONS, []);
    conversations.value = stored;
    return conversations.value;
  };

  /**
   * 保存所有会话
   */
  const saveAllConversations = async (convs: Conversation[]) => {
    conversations.value = convs;
    await setStorage(STORAGE_KEYS.CONVERSATIONS, convs);
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
    const now = Date.now();

    // 如果是临时会话（没有角色），不保存
    if (!character) {
      const tempConversation: Conversation = {
        id: `temp-${now}`,
        title: '临时会话',
        messages: [firstMessage],
        createdAt: now,
        updatedAt: now,
      };
      return tempConversation;
    }

    const newConversation: Conversation = {
      id: `conv-${now}`,
      title: firstMessage.content.slice(0, 30) + (firstMessage.content.length > 30 ? '...' : ''),
      characterId: character.id,
      characterName: character.name,
      messages: [firstMessage],
      createdAt: now,
      updatedAt: now,
    };

    // 添加到会话列表
    const allConversations = await loadAllConversations();
    allConversations.push(newConversation);
    await saveAllConversations(allConversations);

    return newConversation;
  };

  /**
   * 更新会话
   */
  const updateConversation = async (id: string, updates: Partial<Conversation>): Promise<void> => {
    const index = conversations.value.findIndex(c => c.id === id);
    if (index !== -1) {
      conversations.value[index] = {
        ...conversations.value[index]!,
        ...updates,
        updatedAt: Date.now(),
      };
      await saveAllConversations(conversations.value);
    }
  };

  /**
   * 删除会话
   */
  const deleteConversation = async (id: string): Promise<void> => {
    conversations.value = conversations.value.filter(c => c.id !== id);
    await saveAllConversations(conversations.value);
  };

  /**
   * 重命名会话
   */
  const renameConversation = async (id: string, newName: string): Promise<void> => {
    const index = conversations.value.findIndex(c => c.id === id);
    if (index !== -1) {
      conversations.value[index] = {
        ...conversations.value[index]!,
        title: newName,
        updatedAt: Date.now(),
      };
      await saveAllConversations(conversations.value);
    }
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