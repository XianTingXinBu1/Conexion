import { Hono } from 'hono';
import type { AICharacter, Conversation, Message } from '../../src/types';
import type { ServerConfig } from '../config';
import { HttpError } from '../errors';
import { ConversationRepository } from '../repositories/conversationRepository';
import { ensureObjectPayload, readJsonBody, requireNonEmptyString } from '../utils/request';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function ensureMessage(value: unknown, fieldName: string): Message {
  if (!isObject(value)) {
    throw new HttpError(400, `${fieldName} 必须是对象`);
  }

  return {
    id: requireNonEmptyString(value.id, `${fieldName}.id`),
    type: value.type === 'user' || value.type === 'assistant' || value.type === 'system'
      ? value.type
      : (() => { throw new HttpError(400, `${fieldName}.type 无效`); })(),
    content: typeof value.content === 'string' ? value.content : requireNonEmptyString(value.content, `${fieldName}.content`),
    timestamp: typeof value.timestamp === 'number' && Number.isFinite(value.timestamp)
      ? value.timestamp
      : Date.now(),
  };
}

function ensureMessages(value: unknown): Message[] {
  if (!Array.isArray(value)) {
    throw new HttpError(400, 'messages 必须是数组');
  }

  return value.map((message, index) => ensureMessage(message, `messages[${index}]`));
}

function ensureCharacter(value: unknown): AICharacter | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (!isObject(value)) {
    throw new HttpError(400, 'character 必须是对象');
  }

  return {
    id: requireNonEmptyString(value.id, 'character.id'),
    name: requireNonEmptyString(value.name, 'character.name'),
    description: typeof value.description === 'string' ? value.description : '',
    personality: typeof value.personality === 'string' ? value.personality : '',
    knowledgeBaseId: typeof value.knowledgeBaseId === 'string' ? value.knowledgeBaseId : undefined,
    createdAt: typeof value.createdAt === 'number' && Number.isFinite(value.createdAt) ? value.createdAt : Date.now(),
  };
}

function ensureConversation(value: unknown, fieldName: string): Conversation {
  if (!isObject(value)) {
    throw new HttpError(400, `${fieldName} 必须是对象`);
  }

  const createdAt = typeof value.createdAt === 'number' && Number.isFinite(value.createdAt) ? value.createdAt : Date.now();

  return {
    id: requireNonEmptyString(value.id, `${fieldName}.id`),
    title: requireNonEmptyString(value.title, `${fieldName}.title`),
    characterId: typeof value.characterId === 'string' ? value.characterId : undefined,
    characterName: typeof value.characterName === 'string' ? value.characterName : undefined,
    messages: ensureMessages(value.messages),
    compressed: typeof value.compressed === 'boolean' ? value.compressed : undefined,
    compression: isObject(value.compression) ? value.compression as unknown as Conversation['compression'] : undefined,
    createdAt,
    updatedAt: typeof value.updatedAt === 'number' && Number.isFinite(value.updatedAt) ? value.updatedAt : createdAt,
  };
}

function ensureConversations(value: unknown): Conversation[] {
  if (!Array.isArray(value)) {
    throw new HttpError(400, 'conversations 必须是数组');
  }

  return value.map((conversation, index) => ensureConversation(conversation, `conversations[${index}]`));
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export function createConversationRoutes(config: ServerConfig, repository: ConversationRepository) {
  const app = new Hono();

  app.get('/conversations', async () => {
    return jsonResponse(await repository.list());
  });

  app.put('/conversations', async (c) => {
    const payload = ensureObjectPayload(await readJsonBody(c.req.raw, config.maxBodyBytes));
    const conversations = ensureConversations(payload.conversations);
    return jsonResponse(await repository.replaceAll(conversations));
  });

  app.post('/conversations', async (c) => {
    const payload = ensureObjectPayload(await readJsonBody(c.req.raw, config.maxBodyBytes));
    const firstMessage = ensureMessage(payload.firstMessage, 'firstMessage');
    const character = ensureCharacter(payload.character);
    return jsonResponse(await repository.create(firstMessage, character), 201);
  });

  app.get('/conversations/:id', async (c) => {
    const conversation = repository.requireConversation(await repository.get(c.req.param('id')));
    return jsonResponse(conversation);
  });

  app.patch('/conversations/:id', async (c) => {
    const payload = ensureObjectPayload(await readJsonBody(c.req.raw, config.maxBodyBytes));
    const updates = isObject(payload.updates) ? payload.updates as Partial<Conversation> : payload as Partial<Conversation>;
    const updated = repository.requireConversation(await repository.update(c.req.param('id'), updates));
    return jsonResponse(updated);
  });

  app.delete('/conversations/:id', async (c) => {
    const deleted = await repository.delete(c.req.param('id'));
    return jsonResponse({ deleted });
  });

  app.put('/conversations/:id/messages', async (c) => {
    const payload = ensureObjectPayload(await readJsonBody(c.req.raw, config.maxBodyBytes));
    const messages = ensureMessages(payload.messages);
    const updates = isObject(payload.updates) ? payload.updates as Partial<Conversation> : {};
    const updated = repository.requireConversation(await repository.updateMessages(c.req.param('id'), messages, updates));
    return jsonResponse(updated);
  });

  app.patch('/conversations/:id/messages/:messageId', async (c) => {
    const payload = ensureObjectPayload(await readJsonBody(c.req.raw, config.maxBodyBytes));
    const content = typeof payload.content === 'string' ? payload.content : requireNonEmptyString(payload.content, 'content');
    const updated = repository.requireConversation(await repository.editMessage(
      c.req.param('id'),
      c.req.param('messageId'),
      content,
    ));
    return jsonResponse(updated);
  });

  app.delete('/conversations/:id/messages/:messageId', async (c) => {
    const updated = repository.requireConversation(await repository.deleteMessage(
      c.req.param('id'),
      c.req.param('messageId'),
    ));
    return jsonResponse(updated);
  });

  return app;
}
