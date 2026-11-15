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
    // 以前缺 value 会把 undefined 写进去，读回来是 null，前端随后把 null 当成真实值
    if (!('value' in payload)) {
      throw new HttpError(400, '缺少 value');
    }
    return jsonResponse({ value: await repository.set(key, payload.value) });
  });

  app.put('/settings', async (c) => {
    const payload = ensureObjectPayload(await readJsonBody(c.req.raw, config.maxBodyBytes));
    // 带 settings 字段但它不是对象时，以前会把整个 payload（连同 settings 字段本身）
    // 静默写进设置文件，掩盖客户端错误
    if ('settings' in payload && !isObject(payload.settings)) {
      throw new HttpError(400, 'settings 必须是对象');
    }
    const settings = isObject(payload.settings) ? payload.settings : payload;
    return jsonResponse(await repository.replaceAll(settings));
  });

  /**
   * 全量清库。
   *
   * 必须带显式的确认标记：这类不可逆操作不该因为「有人能发 DELETE」就成立
   * （例如误触、脚本复用同一个 baseURL、跨站简单请求）。
   */
  app.delete('/data', async (c) => {
    if (c.req.header('X-Confirm-Destroy') !== 'delete-all-data') {
      throw new HttpError(400, '缺少确认标记（X-Confirm-Destroy: delete-all-data）');
    }
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
