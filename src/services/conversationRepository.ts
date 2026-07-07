import { requestJson } from '@/api/http';
import type { AICharacter, Conversation, Message } from '@/types';

const TEMP_CONVERSATION_PREFIX = 'temp-';
const PERSISTED_CONVERSATION_PREFIX = 'conv-';
const TEMP_CONVERSATION_TITLE = '临时会话';
const CONVERSATIONS_API_BASE = '/api/conversations';

const createConversationTitle = (content: string): string => {
  return content.slice(0, 30) + (content.length > 30 ? '...' : '');
};

const cloneConversation = (conversation: Conversation): Conversation => ({
  ...conversation,
  messages: [...conversation.messages],
  compression: conversation.compression ? { ...conversation.compression } : undefined,
});

function requestConversations<T>(path: string, options: RequestInit = {}): Promise<T> {
  return requestJson<T>(`${CONVERSATIONS_API_BASE}${path}`, options);
}

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

export async function loadStoredConversations(): Promise<Conversation[]> {
  const conversations = await requestConversations<Conversation[]>('');
  return Array.isArray(conversations) ? conversations.map(cloneConversation) : [];
}

export async function saveStoredConversations(conversations: Conversation[]): Promise<void> {
  await requestConversations<Conversation[]>('', {
    method: 'PUT',
    body: JSON.stringify({ conversations }),
  });
}

export async function getStoredConversation(id: string): Promise<Conversation | undefined> {
  if (isTemporaryConversationId(id)) {
    return undefined;
  }

  try {
    return cloneConversation(await requestConversations<Conversation>(`/${encodeURIComponent(id)}`));
  } catch (error) {
    if (error instanceof Error && error.message === '会话不存在') {
      return undefined;
    }

    throw error;
  }
}

export async function createConversationRecord(
  firstMessage: Message,
  character?: AICharacter,
): Promise<Conversation> {
  if (!character) {
    return createTemporaryConversation(firstMessage);
  }

  return cloneConversation(await requestConversations<Conversation>('', {
    method: 'POST',
    body: JSON.stringify({ firstMessage, character }),
  }));
}

export async function updateConversationRecord(
  id: string,
  updates: Partial<Conversation>,
): Promise<Conversation | undefined> {
  if (isTemporaryConversationId(id)) {
    return undefined;
  }

  try {
    return cloneConversation(await requestConversations<Conversation>(`/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ updates }),
    }));
  } catch (error) {
    if (error instanceof Error && error.message === '会话不存在') {
      return undefined;
    }

    throw error;
  }
}

export async function deleteConversationRecord(id: string): Promise<boolean> {
  if (isTemporaryConversationId(id)) {
    return false;
  }

  const result = await requestConversations<{ deleted: boolean }>(`/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  return result.deleted;
}

export async function updateConversationMessages(
  id: string,
  messages: Message[],
  updates: Partial<Conversation> = {},
): Promise<Conversation | undefined> {
  if (messages.length === 0 || isTemporaryConversationId(id)) {
    return undefined;
  }

  try {
    return cloneConversation(await requestConversations<Conversation>(`/${encodeURIComponent(id)}/messages`, {
      method: 'PUT',
      body: JSON.stringify({ messages, updates }),
    }));
  } catch (error) {
    if (error instanceof Error && error.message === '会话不存在') {
      return undefined;
    }

    throw error;
  }
}

export async function editConversationMessage(
  conversationId: string,
  messageId: string,
  newContent: string,
): Promise<Conversation | undefined> {
  if (isTemporaryConversationId(conversationId)) {
    return undefined;
  }

  try {
    return cloneConversation(await requestConversations<Conversation>(
      `/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ content: newContent }),
      },
    ));
  } catch (error) {
    if (error instanceof Error && error.message === '会话不存在') {
      return undefined;
    }

    throw error;
  }
}

export async function deleteConversationMessage(
  conversationId: string,
  messageId: string,
): Promise<Conversation | undefined> {
  if (isTemporaryConversationId(conversationId)) {
    return undefined;
  }

  try {
    return cloneConversation(await requestConversations<Conversation>(
      `/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}`,
      { method: 'DELETE' },
    ));
  } catch (error) {
    if (error instanceof Error && error.message === '会话不存在') {
      return undefined;
    }

    throw error;
  }
}
