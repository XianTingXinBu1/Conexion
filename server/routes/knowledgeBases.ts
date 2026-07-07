import { Hono } from 'hono';
import type { KnowledgeBase, KnowledgeEntry } from '../../src/types';
import type { ServerConfig } from '../config';
import { HttpError } from '../errors';
import { KnowledgeBaseRepository } from '../repositories/knowledgeBaseRepository';
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

function ensureKnowledgeEntry(value: unknown, fieldName: string): KnowledgeEntry {
  if (!isObject(value)) {
    throw new HttpError(400, `${fieldName} 必须是对象`);
  }

  const createdAt = typeof value.createdAt === 'number' && Number.isFinite(value.createdAt) ? value.createdAt : Date.now();

  return {
    id: requireNonEmptyString(value.id, `${fieldName}.id`),
    name: requireNonEmptyString(value.name, `${fieldName}.name`),
    content: typeof value.content === 'string' ? value.content : '',
    enabled: typeof value.enabled === 'boolean' ? value.enabled : true,
    priority: typeof value.priority === 'number' && Number.isFinite(value.priority) ? value.priority : 50,
    createdAt,
    updatedAt: typeof value.updatedAt === 'number' && Number.isFinite(value.updatedAt) ? value.updatedAt : createdAt,
  };
}

function ensureKnowledgeBase(value: unknown, fieldName: string): KnowledgeBase {
  if (!isObject(value)) {
    throw new HttpError(400, `${fieldName} 必须是对象`);
  }

  const createdAt = typeof value.createdAt === 'number' && Number.isFinite(value.createdAt) ? value.createdAt : Date.now();

  return {
    id: requireNonEmptyString(value.id, `${fieldName}.id`),
    name: requireNonEmptyString(value.name, `${fieldName}.name`),
    description: typeof value.description === 'string' ? value.description : '',
    entries: Array.isArray(value.entries)
      ? value.entries.map((entry, index) => ensureKnowledgeEntry(entry, `${fieldName}.entries[${index}]`))
      : [],
    globallyEnabled: typeof value.globallyEnabled === 'boolean' ? value.globallyEnabled : false,
    createdAt,
    updatedAt: typeof value.updatedAt === 'number' && Number.isFinite(value.updatedAt) ? value.updatedAt : createdAt,
  };
}

function ensureKnowledgeBases(value: unknown): KnowledgeBase[] {
  if (!Array.isArray(value)) {
    throw new HttpError(400, 'knowledgeBases 必须是数组');
  }

  return value.map((knowledgeBase, index) => ensureKnowledgeBase(knowledgeBase, `knowledgeBases[${index}]`));
}

export function createKnowledgeBaseRoutes(config: ServerConfig, repository: KnowledgeBaseRepository) {
  const app = new Hono();

  app.get('/knowledge-bases', async () => {
    return jsonResponse(await repository.list());
  });

  app.put('/knowledge-bases', async (c) => {
    const payload = ensureObjectPayload(await readJsonBody(c.req.raw, config.maxBodyBytes));
    return jsonResponse(await repository.replaceAll(ensureKnowledgeBases(payload.knowledgeBases)));
  });

  return app;
}
