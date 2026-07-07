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

async function readApiJson<T>(response: Response): Promise<T> {
  if (response.ok) {
    return await response.json() as T;
  }

  let message = `请求失败 (${response.status})`;
  try {
    const data = await response.json() as { error?: { message?: string }; message?: string };
    message = data.error?.message || data.message || message;
  } catch {
    // 保留默认错误信息
  }

  throw new Error(message);
}

async function requestJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${CONVERSATIONS_API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  return readApiJson<T>(response);
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
  const conversations = await requestJson<Conversation[]>('');
  return Array.isArray(conversations) ? conversations.map(cloneConversation) : [];
}

export async function saveStoredConversations(conversations: Conversation[]): Promise<void> {
  await requestJson<Conversation[]>('', {
    method: 'PUT',
    body: JSON.stringify({ conversations }),
  });
}

export async function getStoredConversation(id: string): Promise<Conversation | undefined> {
  if (isTemporaryConversationId(id)) {
    return undefined;
  }

  try {
    return cloneConversation(await requestJson<Conversation>(`/${encodeURIComponent(id)}`));
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

  return cloneConversation(await requestJson<Conversation>('', {
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
    return cloneConversation(await requestJson<Conversation>(`/${encodeURIComponent(id)}`, {
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

  const result = await requestJson<{ deleted: boolean }>(`/${encodeURIComponent(id)}`, {
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
    return cloneConversation(await requestJson<Conversation>(`/${encodeURIComponent(id)}/messages`, {
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
    return cloneConversation(await requestJson<Conversation>(
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
    return cloneConversation(await requestJson<Conversation>(
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
