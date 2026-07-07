import { Hono } from 'hono';
import type { RegexRule } from '../../src/types';
import type { ServerConfig } from '../config';
import { HttpError } from '../errors';
import { SettingsRepository } from '../repositories/settingsRepository';
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

function ensureRegexRule(value: unknown, fieldName: string): RegexRule {
  if (!isObject(value)) {
    throw new HttpError(400, `${fieldName} 必须是对象`);
  }

  return {
    id: requireNonEmptyString(value.id, `${fieldName}.id`),
    name: requireNonEmptyString(value.name, `${fieldName}.name`),
    enabled: typeof value.enabled === 'boolean' ? value.enabled : true,
    pattern: typeof value.pattern === 'string' ? value.pattern : '',
    flags: typeof value.flags === 'string' ? value.flags : '',
    replacement: typeof value.replacement === 'string' ? value.replacement : '',
    scope: value.scope === 'user' || value.scope === 'assistant' || value.scope === 'all' ? value.scope : 'all',
    applyTo: value.applyTo === 'before-macro' || value.applyTo === 'after-macro' ? value.applyTo : 'after-macro',
  };
}

function ensureRegexRules(value: unknown): RegexRule[] {
  if (!Array.isArray(value)) {
    throw new HttpError(400, 'rules 必须是数组');
  }

  return value.map((rule, index) => ensureRegexRule(rule, `rules[${index}]`));
}

export function createSettingsRoutes(config: ServerConfig, repository: SettingsRepository) {
  const app = new Hono();

  app.get('/settings', async () => {
    return jsonResponse(await repository.getAll());
  });

  app.get('/settings/:key', async (c) => {
    const key = c.req.param('key');
    const defaultValue = new URL(c.req.url).searchParams.get('default');
    return jsonResponse({ value: await repository.get(key, defaultValue) });
  });

  app.put('/settings/:key', async (c) => {
    const key = c.req.param('key');
    const payload = ensureObjectPayload(await readJsonBody(c.req.raw, config.maxBodyBytes));
    return jsonResponse({ value: await repository.set(key, payload.value) });
  });

  app.put('/settings', async (c) => {
    const payload = ensureObjectPayload(await readJsonBody(c.req.raw, config.maxBodyBytes));
    const settings = isObject(payload.settings) ? payload.settings : payload;
    return jsonResponse(await repository.replaceAll(settings));
  });

  app.delete('/data', async () => {
    await repository.clear();
    return jsonResponse({ ok: true });
  });

  app.get('/regex-rules', async () => {
    return jsonResponse(await repository.listRegexRules());
  });

  app.put('/regex-rules', async (c) => {
    const payload = ensureObjectPayload(await readJsonBody(c.req.raw, config.maxBodyBytes));
    return jsonResponse(await repository.replaceRegexRules(ensureRegexRules(payload.rules)));
  });

  return app;
}
