import type { AICharacter, Conversation, Message } from '../../src/types';
import { randomUUID } from 'node:crypto';
import { HttpError } from '../errors';
import type { AppStorage } from '../storage/appStorage';

const TEMP_CONVERSATION_PREFIX = 'temp-';
const PERSISTED_CONVERSATION_PREFIX = 'conv-';
const TEMP_CONVERSATION_TITLE = '临时会话';

const createConversationTitle = (content: string): string => {
  return content.slice(0, 30) + (content.length > 30 ? '...' : '');
};

/**
 * 会话副本。messages 里的 variants / reasoningVariants 都是数组，
 * 只拷数组壳会让调用方改一条消息就污染仓储缓存与落盘数据。
 */
const cloneMessage = (message: Message): Message => ({
  ...message,
  ...(message.variants ? { variants: [...message.variants] } : {}),
  ...(message.reasoningVariants ? { reasoningVariants: [...message.reasoningVariants] } : {}),
});

const cloneConversation = (conversation: Conversation): Conversation => ({
  ...conversation,
  messages: conversation.messages.map(cloneMessage),
  compression: conversation.compression
    ? { ...conversation.compression, sourceMessageIds: [...conversation.compression.sourceMessageIds] }
    : undefined,
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
  id: `${TEMP_CONVERSATION_PREFIX}${randomUUID()}`,
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
  id: `${PERSISTED_CONVERSATION_PREFIX}${randomUUID()}`,
  title: createConversationTitle(firstMessage.content),
  characterId: character.id,
  characterName: character.name,
  messages: [firstMessage],
  createdAt: now,
  updatedAt: now,
});

export class ConversationRepository {
  private readonly storage: AppStorage;
  /**
   * 写操作串行化。
   *
   * 所有写都是「读全量 → 改内存 → 写全量」，并发请求会各自基于同一份快照写回，
   * 后写者覆盖先写者（同时编辑两个会话时表现最明显）。storage 只串行化了 write，
   * 挡不住 read-modify-write 之间的竞态，所以这里在仓储层排队。
   */
  private writeChain: Promise<unknown> = Promise.resolve();

  constructor(storage: AppStorage) {
    this.storage = storage;
  }

  async list(): Promise<Conversation[]> {
    const conversations = await this.storage.conversations.read();
    return Array.isArray(conversations) ? conversations.map(cloneConversation) : [];
  }

  async replaceAll(conversations: Conversation[]): Promise<Conversation[]> {
    return this.runExclusive(async () => {
      const nextConversations = conversations.map(cloneConversation);
      await this.storage.conversations.write(nextConversations);
      return nextConversations.map(cloneConversation);
    });
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

    return this.runExclusive(async () => {
      const conversations = await this.list();
      const newConversation = createStoredConversation(firstMessage, character);

      // id 是 UUID，撞车意味着调用方显式塞了重复 id：报错好过静默覆盖掉旧会话
      if (conversations.some(conversation => conversation.id === newConversation.id)) {
        throw new HttpError(409, '会话 ID 冲突');
      }

      conversations.push(newConversation);
      await this.storage.conversations.write(conversations);
      return cloneConversation(newConversation);
    });
  }

  async update(id: string, updates: Partial<Conversation>): Promise<Conversation | undefined> {
    return this.mutate(id, conversation => ({
      ...conversation,
      ...updates,
      updatedAt: Date.now(),
    }));
  }

  async delete(id: string): Promise<boolean> {
    if (isTemporaryConversationId(id)) {
      return false;
    }

    return this.runExclusive(async () => {
      const conversations = await this.list();
      const nextConversations = conversations.filter(conversation => conversation.id !== id);

      if (nextConversations.length === conversations.length) {
        return false;
      }

      await this.storage.conversations.write(nextConversations);
      return true;
    });
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
    return this.mutate(conversationId, conversation => {
      const messageIndex = conversation.messages.findIndex(message => message.id === messageId);
      if (messageIndex === -1) {
        return undefined;
      }

      const originalMessage = conversation.messages[messageIndex]!;
      const nextMessages = [...conversation.messages];

      // 带变体的消息只改当前那一条，否则切回去会看到编辑前的内容。
      const nextMessage: Message = { ...originalMessage, content: newContent };
      const variants = originalMessage.variants;

      if (variants && variants.length > 0) {
        const activeVariantIndex = Math.min(
          variants.length - 1,
          Math.max(0, originalMessage.activeVariantIndex ?? 0),
        );
        const nextVariants = [...variants];
        nextVariants[activeVariantIndex] = newContent;
        nextMessage.variants = nextVariants;
        nextMessage.activeVariantIndex = activeVariantIndex;
      }

      nextMessages[messageIndex] = nextMessage;

      return {
        ...conversation,
        ...clearCompressionIfSourceChanged(conversation, [messageId]),
        messages: nextMessages,
        updatedAt: Date.now(),
      };
    });
  }

  async deleteMessage(conversationId: string, messageId: string): Promise<Conversation | undefined> {
    return this.mutate(conversationId, conversation => {
      const nextMessages = conversation.messages.filter(message => message.id !== messageId);
      if (nextMessages.length === conversation.messages.length) {
        return undefined;
      }

      return {
        ...conversation,
        ...clearCompressionIfSourceChanged(conversation, [messageId]),
        messages: nextMessages,
        updatedAt: Date.now(),
      };
    });
  }

  requireConversation(conversation: Conversation | undefined): Conversation {
    if (!conversation) {
      throw new HttpError(404, '会话不存在');
    }

    return conversation;
  }

  /**
   * 写队列：用一条 Promise 链把所有写操作串起来，前一个失败不影响后续排队。
   */
  private runExclusive<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.writeChain.catch(() => {}).then(operation);
    this.writeChain = next;
    return next;
  }

  /**
   * 会话变更的单一入口：读一次、找一次、写一次。
   *
   * 此前的 editMessage / deleteMessage 先 get() 再 update()，会对同一个
   * conversations.json 读两次；这里收敛成单读单写，避免重复 IO。
   * transform 返回 undefined 表示“没有变化/目标不存在”，此时不落盘。
   */
  private async mutate(
    id: string,
    transform: (conversation: Conversation) => Conversation | undefined,
  ): Promise<Conversation | undefined> {
    if (isTemporaryConversationId(id)) {
      return undefined;
    }

    return this.runExclusive(async () => {
      const conversations = await this.list();
      const index = conversations.findIndex(conversation => conversation.id === id);

      if (index === -1) {
        return undefined;
      }

      const updated = transform(conversations[index]!);
      if (!updated) {
        return undefined;
      }

      conversations[index] = updated;
      await this.storage.conversations.write(conversations);
      return cloneConversation(updated);
    });
  }
}
