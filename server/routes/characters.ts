import { Hono } from 'hono';
import type { AICharacter, UserCharacter } from '../../src/types';
import type { ServerConfig } from '../config';
import { HttpError } from '../errors';
import { CharacterRepository } from '../repositories/characterRepository';
import { ensureObjectPayload, readJsonBody, requireNonEmptyString } from '../utils/request';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function ensureUserCharacter(value: unknown, fieldName: string): UserCharacter {
  if (!isObject(value)) {
    throw new HttpError(400, `${fieldName} 必须是对象`);
  }

  return {
    id: requireNonEmptyString(value.id, `${fieldName}.id`),
    name: requireNonEmptyString(value.name, `${fieldName}.name`),
    description: typeof value.description === 'string' ? value.description : '',
    createdAt: typeof value.createdAt === 'number' && Number.isFinite(value.createdAt) ? value.createdAt : Date.now(),
  };
}

function ensureAICharacter(value: unknown, fieldName: string): AICharacter {
  if (!isObject(value)) {
    throw new HttpError(400, `${fieldName} 必须是对象`);
  }

  return {
    id: requireNonEmptyString(value.id, `${fieldName}.id`),
    name: requireNonEmptyString(value.name, `${fieldName}.name`),
    description: typeof value.description === 'string' ? value.description : '',
    personality: typeof value.personality === 'string' ? value.personality : '',
    knowledgeBaseId: typeof value.knowledgeBaseId === 'string' && value.knowledgeBaseId.trim()
      ? value.knowledgeBaseId
      : undefined,
    createdAt: typeof value.createdAt === 'number' && Number.isFinite(value.createdAt) ? value.createdAt : Date.now(),
  };
}

function ensureUserCharacters(value: unknown): UserCharacter[] {
  if (!Array.isArray(value)) {
    throw new HttpError(400, 'characters 必须是数组');
  }

  return value.map((character, index) => ensureUserCharacter(character, `characters[${index}]`));
}

function ensureAICharacters(value: unknown): AICharacter[] {
  if (!Array.isArray(value)) {
    throw new HttpError(400, 'characters 必须是数组');
  }

  return value.map((character, index) => ensureAICharacter(character, `characters[${index}]`));
}

export function createCharacterRoutes(config: ServerConfig, repository: CharacterRepository) {
  const app = new Hono();

  app.get('/characters/users', async () => {
    return jsonResponse(await repository.listUserCharacters());
  });

  app.put('/characters/users', async (c) => {
    const payload = ensureObjectPayload(await readJsonBody(c.req.raw, config.maxBodyBytes));
    return jsonResponse(await repository.replaceUserCharacters(ensureUserCharacters(payload.characters)));
  });

  app.get('/characters/ai', async () => {
    return jsonResponse(await repository.listAICharacters());
  });

  app.put('/characters/ai', async (c) => {
    const payload = ensureObjectPayload(await readJsonBody(c.req.raw, config.maxBodyBytes));
    return jsonResponse(await repository.replaceAICharacters(ensureAICharacters(payload.characters)));
  });

  app.get('/characters/ai/:id', async (c) => {
    const character = await repository.getAICharacter(c.req.param('id'));
    if (!character) {
      throw new HttpError(404, '角色不存在');
    }

    return jsonResponse(character);
  });

  app.post('/characters/ai/clear-knowledge-base-reference', async (c) => {
    const payload = ensureObjectPayload(await readJsonBody(c.req.raw, config.maxBodyBytes));
    const knowledgeBaseId = requireNonEmptyString(payload.knowledgeBaseId, 'knowledgeBaseId');
    return jsonResponse({ changed: await repository.clearKnowledgeBaseReference(knowledgeBaseId) });
  });

  return app;
}
