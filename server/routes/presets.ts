import { Hono } from 'hono';
import type { Preset, PromptItem, PromptPreset } from '../../src/types';
import type { ServerConfig } from '../config';
import { HttpError } from '../errors';
import { ApiPresetRepository, PromptPresetRepository } from '../repositories/presetRepositories';
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

function ensureApiPreset(value: unknown, fieldName: string): Preset {
  if (!isObject(value)) {
    throw new HttpError(400, `${fieldName} 必须是对象`);
  }

  const createdAt = typeof value.createdAt === 'number' && Number.isFinite(value.createdAt) ? value.createdAt : Date.now();

  return {
    id: requireNonEmptyString(value.id, `${fieldName}.id`),
    name: requireNonEmptyString(value.name, `${fieldName}.name`),
    url: typeof value.url === 'string' ? value.url : '',
    apiKey: typeof value.apiKey === 'string' ? value.apiKey : '',
    model: typeof value.model === 'string' ? value.model : '',
    streamEnabled: typeof value.streamEnabled === 'boolean' ? value.streamEnabled : true,
    temperature: typeof value.temperature === 'number' && Number.isFinite(value.temperature) ? value.temperature : 0.7,
    maxTokens: typeof value.maxTokens === 'number' && Number.isFinite(value.maxTokens) ? value.maxTokens : 2048,
    maxOutputTokens: typeof value.maxOutputTokens === 'number' && Number.isFinite(value.maxOutputTokens) ? value.maxOutputTokens : 4096,
    contextLength: typeof value.contextLength === 'number' && Number.isFinite(value.contextLength) ? value.contextLength : undefined,
    createdAt,
    updatedAt: typeof value.updatedAt === 'number' && Number.isFinite(value.updatedAt) ? value.updatedAt : createdAt,
  };
}

function ensureApiPresets(value: unknown): Preset[] {
  if (!Array.isArray(value)) {
    throw new HttpError(400, 'presets 必须是数组');
  }

  return value.map((preset, index) => ensureApiPreset(preset, `presets[${index}]`));
}

function ensurePromptItem(value: unknown, fieldName: string): PromptItem {
  if (!isObject(value)) {
    throw new HttpError(400, `${fieldName} 必须是对象`);
  }

  return {
    id: requireNonEmptyString(value.id, `${fieldName}.id`),
    name: requireNonEmptyString(value.name, `${fieldName}.name`),
    description: typeof value.description === 'string' ? value.description : '',
    enabled: typeof value.enabled === 'boolean' ? value.enabled : true,
    prompt: typeof value.prompt === 'string' ? value.prompt : '',
    roleType: value.roleType === 'system' || value.roleType === 'user' || value.roleType === 'assistant'
      ? value.roleType
      : 'system',
    insertPosition: typeof value.insertPosition === 'number' && Number.isFinite(value.insertPosition)
      ? value.insertPosition
      : undefined,
  };
}

function ensurePromptPreset(value: unknown, fieldName: string): PromptPreset {
  if (!isObject(value)) {
    throw new HttpError(400, `${fieldName} 必须是对象`);
  }

  const createdAt = typeof value.createdAt === 'number' && Number.isFinite(value.createdAt) ? value.createdAt : Date.now();

  return {
    id: requireNonEmptyString(value.id, `${fieldName}.id`),
    name: requireNonEmptyString(value.name, `${fieldName}.name`),
    items: Array.isArray(value.items)
      ? value.items.map((item, index) => ensurePromptItem(item, `${fieldName}.items[${index}]`))
      : [],
    createdAt,
    updatedAt: typeof value.updatedAt === 'number' && Number.isFinite(value.updatedAt) ? value.updatedAt : createdAt,
  };
}

function ensurePromptPresets(value: unknown): PromptPreset[] {
  if (!Array.isArray(value)) {
    throw new HttpError(400, 'presets 必须是数组');
  }

  return value.map((preset, index) => ensurePromptPreset(preset, `presets[${index}]`));
}

export function createPresetRoutes(
  config: ServerConfig,
  apiPresetRepository: ApiPresetRepository,
  promptPresetRepository: PromptPresetRepository,
) {
  const app = new Hono();

  app.get('/api-presets', async () => {
    return jsonResponse(await apiPresetRepository.list());
  });

  app.put('/api-presets', async (c) => {
    const payload = ensureObjectPayload(await readJsonBody(c.req.raw, config.maxBodyBytes));
    return jsonResponse(await apiPresetRepository.replaceAll(ensureApiPresets(payload.presets)));
  });

  app.get('/prompt-presets', async () => {
    return jsonResponse(await promptPresetRepository.list());
  });

  app.put('/prompt-presets', async (c) => {
    const payload = ensureObjectPayload(await readJsonBody(c.req.raw, config.maxBodyBytes));
    return jsonResponse(await promptPresetRepository.replaceAll(ensurePromptPresets(payload.presets)));
  });

  return app;
}
