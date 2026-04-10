import type { AICharacter, Conversation, Message } from '@/types';
import { STORAGE_KEYS } from '@/constants';
import { getStorage, setStorage } from '@/utils/storage';

const TEMP_CONVERSATION_PREFIX = 'temp-';
const PERSISTED_CONVERSATION_PREFIX = 'conv-';
const TEMP_CONVERSATION_TITLE = '临时会话';

const createConversationTitle = (content: string): string => {
  return content.slice(0, 30) + (content.length > 30 ? '...' : '');
};

const cloneConversation = (conversation: Conversation): Conversation => ({
  ...conversation,
  messages: [...conversation.messages],
});

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
  now = Date.now()
): Conversation => ({
  id: `${PERSISTED_CONVERSATION_PREFIX}${now}`,
  title: createConversationTitle(firstMessage.content),
  characterId: character.id,
  characterName: character.name,
  messages: [firstMessage],
  createdAt: now,
  updatedAt: now,
});

export async function loadStoredConversations(): Promise<Conversation[]> {
  const stored = await getStorage<Conversation[]>(STORAGE_KEYS.CONVERSATIONS, []);
  return Array.isArray(stored) ? stored : [];
}

export async function saveStoredConversations(conversations: Conversation[]): Promise<void> {
  await setStorage(STORAGE_KEYS.CONVERSATIONS, conversations);
}

export async function getStoredConversation(id: string): Promise<Conversation | undefined> {
  const conversations = await loadStoredConversations();
  const conversation = conversations.find(item => item.id === id);
  return conversation ? cloneConversation(conversation) : undefined;
}

export async function createConversationRecord(
  firstMessage: Message,
  character?: AICharacter
): Promise<Conversation> {
  if (!character) {
    return createTemporaryConversation(firstMessage);
  }

  const conversations = await loadStoredConversations();
  const newConversation = createStoredConversation(firstMessage, character);

  const existingIndex = conversations.findIndex(conversation => conversation.id === newConversation.id);
  if (existingIndex !== -1) {
    conversations[existingIndex] = newConversation;
  } else {
    conversations.push(newConversation);
  }

  await saveStoredConversations(conversations);

  return cloneConversation(newConversation);
}

export async function updateConversationRecord(
  id: string,
  updates: Partial<Conversation>
): Promise<Conversation | undefined> {
  if (isTemporaryConversationId(id)) {
    return undefined;
  }

  const conversations = await loadStoredConversations();
  const index = conversations.findIndex(conversation => conversation.id === id);

  if (index === -1) {
    return undefined;
  }

  const existing = conversations[index]!;
  const updated: Conversation = {
    ...existing,
    ...updates,
    updatedAt: Date.now(),
  };

  conversations[index] = updated;
  await saveStoredConversations(conversations);

  return cloneConversation(updated);
}

export async function deleteConversationRecord(id: string): Promise<boolean> {
  if (isTemporaryConversationId(id)) {
    return false;
  }

  const conversations = await loadStoredConversations();
  const nextConversations = conversations.filter(conversation => conversation.id !== id);

  if (nextConversations.length === conversations.length) {
    return false;
  }

  await saveStoredConversations(nextConversations);
  return true;
}

export async function updateConversationMessages(
  id: string,
  messages: Message[]
): Promise<Conversation | undefined> {
  if (messages.length === 0) {
    return undefined;
  }

  return updateConversationRecord(id, { messages });
}

export async function editConversationMessage(
  conversationId: string,
  messageId: string,
  newContent: string
): Promise<Conversation | undefined> {
  if (isTemporaryConversationId(conversationId)) {
    return undefined;
  }

  const conversation = await getStoredConversation(conversationId);

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

  return updateConversationRecord(conversationId, { messages: nextMessages });
}

export async function deleteConversationMessage(
  conversationId: string,
  messageId: string
): Promise<Conversation | undefined> {
  if (isTemporaryConversationId(conversationId)) {
    return undefined;
  }

  const conversation = await getStoredConversation(conversationId);

  if (!conversation) {
    return undefined;
  }

  const nextMessages = conversation.messages.filter(message => message.id !== messageId);

  if (nextMessages.length === conversation.messages.length) {
    return undefined;
  }

  return updateConversationRecord(conversationId, { messages: nextMessages });
}
