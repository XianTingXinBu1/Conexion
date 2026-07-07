import type { AICharacter, Conversation, Message } from '../../src/types';
import { HttpError } from '../errors';
import type { AppStorage } from '../storage/appStorage';

const TEMP_CONVERSATION_PREFIX = 'temp-';
const PERSISTED_CONVERSATION_PREFIX = 'conv-';
const TEMP_CONVERSATION_TITLE = '临时会话';

const createConversationTitle = (content: string): string => {
  return content.slice(0, 30) + (content.length > 30 ? '...' : '');
};

const cloneConversation = (conversation: Conversation): Conversation => ({
  ...conversation,
  messages: [...conversation.messages],
  compression: conversation.compression ? { ...conversation.compression } : undefined,
});

const clearCompressionIfSourceChanged = (
  conversation: Conversation,
  changedMessageIds: string[],
): Partial<Conversation> => {
  const sourceMessageIds = conversation.compression?.sourceMessageIds ?? [];
  const changedCompressedSource = changedMessageIds.some(id => sourceMessageIds.includes(id));

  return changedCompressedSource
    ? { compressed: false, compression: undefined }
    : {};
};

export const isTemporaryConversationId = (id?: string): boolean => {
  return !!id && id.startsWith(TEMP_CONVERSATION_PREFIX);
};

export const createTemporaryConversation = (firstMessage: Message, now = Date.now()): Conversation => ({
  id: `${TEMP_CONVERSATION_PREFIX}${now}`,
  title: TEMP_CONVERSATION_TITLE,
  messages: [firstMessage],
  createdAt: now,
  updatedAt: now,
});

export const createStoredConversation = (
  firstMessage: Message,
  character: AICharacter,
  now = Date.now(),
): Conversation => ({
  id: `${PERSISTED_CONVERSATION_PREFIX}${now}`,
  title: createConversationTitle(firstMessage.content),
  characterId: character.id,
  characterName: character.name,
  messages: [firstMessage],
  createdAt: now,
  updatedAt: now,
});

export class ConversationRepository {
  private readonly storage: AppStorage;

  constructor(storage: AppStorage) {
    this.storage = storage;
  }

  async list(): Promise<Conversation[]> {
    const conversations = await this.storage.conversations.read();
    return Array.isArray(conversations) ? conversations.map(cloneConversation) : [];
  }

  async replaceAll(conversations: Conversation[]): Promise<Conversation[]> {
    const nextConversations = conversations.map(cloneConversation);
    await this.storage.conversations.write(nextConversations);
    return nextConversations.map(cloneConversation);
  }

  async get(id: string): Promise<Conversation | undefined> {
    const conversations = await this.list();
    const conversation = conversations.find(item => item.id === id);
    return conversation ? cloneConversation(conversation) : undefined;
  }

  async create(firstMessage: Message, character?: AICharacter): Promise<Conversation> {
    if (!character) {
      return createTemporaryConversation(firstMessage);
    }

    const conversations = await this.list();
    const newConversation = createStoredConversation(firstMessage, character);
    const existingIndex = conversations.findIndex(conversation => conversation.id === newConversation.id);

    if (existingIndex !== -1) {
      conversations[existingIndex] = newConversation;
    } else {
      conversations.push(newConversation);
    }

    await this.storage.conversations.write(conversations);
    return cloneConversation(newConversation);
  }

  async update(id: string, updates: Partial<Conversation>): Promise<Conversation | undefined> {
    if (isTemporaryConversationId(id)) {
      return undefined;
    }

    const conversations = await this.list();
    const index = conversations.findIndex(conversation => conversation.id === id);

    if (index === -1) {
      return undefined;
    }

    const updated: Conversation = {
      ...conversations[index]!,
      ...updates,
      updatedAt: Date.now(),
    };

    conversations[index] = updated;
    await this.storage.conversations.write(conversations);
    return cloneConversation(updated);
  }

  async delete(id: string): Promise<boolean> {
    if (isTemporaryConversationId(id)) {
      return false;
    }

    const conversations = await this.list();
    const nextConversations = conversations.filter(conversation => conversation.id !== id);

    if (nextConversations.length === conversations.length) {
      return false;
    }

    await this.storage.conversations.write(nextConversations);
    return true;
  }

  async updateMessages(
    id: string,
    messages: Message[],
    updates: Partial<Conversation> = {},
  ): Promise<Conversation | undefined> {
    if (messages.length === 0) {
      return undefined;
    }

    return this.update(id, { ...updates, messages });
  }

  async editMessage(
    conversationId: string,
    messageId: string,
    newContent: string,
  ): Promise<Conversation | undefined> {
    if (isTemporaryConversationId(conversationId)) {
      return undefined;
    }

    const conversation = await this.get(conversationId);
    if (!conversation) {
      return undefined;
    }

    const messageIndex = conversation.messages.findIndex(message => message.id === messageId);
    if (messageIndex === -1) {
      return undefined;
    }

    const originalMessage = conversation.messages[messageIndex]!;
    const nextMessages = [...conversation.messages];
    nextMessages[messageIndex] = {
      id: originalMessage.id,
      type: originalMessage.type,
      content: newContent,
      timestamp: originalMessage.timestamp,
    };

    return this.update(conversationId, {
      ...clearCompressionIfSourceChanged(conversation, [messageId]),
      messages: nextMessages,
    });
  }

  async deleteMessage(conversationId: string, messageId: string): Promise<Conversation | undefined> {
    if (isTemporaryConversationId(conversationId)) {
      return undefined;
    }

    const conversation = await this.get(conversationId);
    if (!conversation) {
      return undefined;
    }

    const nextMessages = conversation.messages.filter(message => message.id !== messageId);
    if (nextMessages.length === conversation.messages.length) {
      return undefined;
    }

    return this.update(conversationId, {
      ...clearCompressionIfSourceChanged(conversation, [messageId]),
      messages: nextMessages,
    });
  }

  requireConversation(conversation: Conversation | undefined): Conversation {
    if (!conversation) {
      throw new HttpError(404, '会话不存在');
    }

    return conversation;
  }
}
