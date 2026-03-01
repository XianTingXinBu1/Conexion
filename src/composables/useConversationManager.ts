import { ref } from 'vue';
import type { Message, Conversation, AICharacter } from '../types';
import { STORAGE_KEYS } from '../constants';
import { getStorage, setStorage } from '@/utils/storage';

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

    const conversations = await getStorage<Conversation[]>(STORAGE_KEYS.CONVERSATIONS, []);

    const conversation = conversations.find(c => c.id === id);
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
    const now = Date.now();

    if (!character) {
      const tempConversation: Conversation = {
        id: `temp-${now}`,
        title: '临时会话',
        messages: [firstMessage],
        createdAt: now,
        updatedAt: now,
      };
      currentConversationId.value = tempConversation.id;
      currentConversation.value = tempConversation;
      return tempConversation;
    }

    const conversations = await getStorage<Conversation[]>(STORAGE_KEYS.CONVERSATIONS, []);

    const newConversation: Conversation = {
      id: `conv-${now}`,
      title: firstMessage.content.slice(0, 30) + (firstMessage.content.length > 30 ? '...' : ''),
      characterId: character.id,
      characterName: character.name,
      messages: [firstMessage],
      createdAt: now,
      updatedAt: now,
    };

    conversations.push(newConversation);
    await setStorage(STORAGE_KEYS.CONVERSATIONS, conversations);

    currentConversationId.value = newConversation.id;
    currentConversation.value = newConversation;
    emitUpdateConversation(newConversation);

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
    if (currentConversationId.value.startsWith('temp-')) {
      return;
    }

    const conversations = await getStorage<Conversation[]>(STORAGE_KEYS.CONVERSATIONS, []);

    const index = conversations.findIndex(c => c.id === currentConversationId.value);

    if (index !== -1) {
      const existing = conversations[index]!;
      const updated: Conversation = {
        id: existing.id,
        title: existing.title,
        createdAt: existing.createdAt,
        characterId: existing.characterId,
        characterName: existing.characterName,
        messages: messages,
        updatedAt: Date.now(),
      };
      conversations[index] = updated;
      await setStorage(STORAGE_KEYS.CONVERSATIONS, conversations);
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

    // 临时会话不支持编辑
    if (currentConversationId.value.startsWith('temp-')) {
      return false;
    }

    const conversations = await getStorage<Conversation[]>(STORAGE_KEYS.CONVERSATIONS, []);
    const index = conversations.findIndex(c => c.id === currentConversationId.value);

    if (index === -1) {
      return false;
    }

    const conversation = conversations[index]!;
    const messageIndex = conversation.messages.findIndex(m => m.id === messageId);

    if (messageIndex === -1) {
      return false;
    }

    const originalMessage = conversation.messages[messageIndex]!;
    conversation.messages[messageIndex] = {
      id: originalMessage.id,
      type: originalMessage.type,
      content: newContent,
      timestamp: originalMessage.timestamp,
    };
    conversation.updatedAt = Date.now();

    conversations[index] = conversation;
    await setStorage(STORAGE_KEYS.CONVERSATIONS, conversations);
    currentConversation.value = conversation;
    emitUpdateConversation(conversation);

    return true;
  };

  /**
   * 删除消息
   */
  const deleteMessage = async (messageId: string): Promise<boolean> => {
    if (!currentConversationId.value) {
      return false;
    }

    // 临时会话不支持删除
    if (currentConversationId.value.startsWith('temp-')) {
      return false;
    }

    const conversations = await getStorage<Conversation[]>(STORAGE_KEYS.CONVERSATIONS, []);
    const index = conversations.findIndex(c => c.id === currentConversationId.value);

    if (index === -1) {
      return false;
    }

    const conversation = conversations[index]!;
    const messageIndex = conversation.messages.findIndex(m => m.id === messageId);

    if (messageIndex === -1) {
      return false;
    }

    conversation.messages.splice(messageIndex, 1);
    conversation.updatedAt = Date.now();

    conversations[index] = conversation;
    await setStorage(STORAGE_KEYS.CONVERSATIONS, conversations);
    currentConversation.value = conversation;
    emitUpdateConversation(conversation);

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