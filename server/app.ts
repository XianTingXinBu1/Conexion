import { Hono } from 'hono';
import type { ServerConfig } from './config';
import { isHttpError, mapUpstreamError } from './errors';
import { CharacterRepository } from './repositories/characterRepository';
import { ConversationRepository } from './repositories/conversationRepository';
import { KnowledgeBaseRepository } from './repositories/knowledgeBaseRepository';
import { ApiPresetRepository, PromptPresetRepository } from './repositories/presetRepositories';
import { SettingsRepository } from './repositories/settingsRepository';
import { createCharacterRoutes } from './routes/characters';
import { createConversationRoutes } from './routes/conversations';
import { createHealthRoutes } from './routes/health';
import { createKnowledgeBaseRoutes } from './routes/knowledgeBases';
import { createPresetRoutes } from './routes/presets';
import { createProxyRoutes } from './routes/proxy';
import { createSettingsRoutes } from './routes/settings';
import { createAppStorage, type AppStorage } from './storage/appStorage';

function applyCorsHeaders(response: Response, config: ServerConfig): Response {
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', config.clientOrigin);
  headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  // 允许的来源来自配置而非请求头，但响应依然随 Origin 变化，
  // 不声明 Vary 会让中间缓存把 A 来源的响应发给 B
  headers.append('Vary', 'Origin');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function jsonResponse(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export function createHonoApp(config: ServerConfig, storage: AppStorage = createAppStorage(config)) {
  const app = new Hono();
  const apiPresetRepository = new ApiPresetRepository(storage);
  const characterRepository = new CharacterRepository(storage);
  const conversationRepository = new ConversationRepository(storage);
  const knowledgeBaseRepository = new KnowledgeBaseRepository(storage);
  const promptPresetRepository = new PromptPresetRepository(storage);
  const settingsRepository = new SettingsRepository(storage);

  app.use('*', async (c, next) => {
    if (c.req.method === 'OPTIONS') {
      return applyCorsHeaders(new Response(null, { status: 204 }), config);
    }

    await next();
    c.res = applyCorsHeaders(c.res, config);
  });

  app.route('/api', createHealthRoutes());
  app.route('/api', createCharacterRoutes(config, characterRepository));
  app.route('/api', createConversationRoutes(config, conversationRepository));
  app.route('/api', createKnowledgeBaseRoutes(config, knowledgeBaseRepository));
  app.route('/api', createPresetRoutes(config, apiPresetRepository, promptPresetRepository));
  app.route('/api', createSettingsRoutes(config, settingsRepository));
  app.route('/api', createProxyRoutes(config));

  // 错误响应也要带 CORS 头：中间件里的 `c.res = applyCorsHeaders(...)` 只在
  // 正常返回时执行，下游抛错会直接跳到 onError，浏览器因此只能看到 CORS 错误、
  // 读不到真实报错
  app.notFound(() => applyCorsHeaders(jsonResponse({ error: { message: 'Not Found' } }, 404), config));

  app.onError((error, _c) => {
    if (isHttpError(error)) {
      return applyCorsHeaders(
        jsonResponse({ error: { message: error.message } }, error.statusCode),
        config,
      );
    }

    const upstreamError = mapUpstreamError(error, 'Internal Server Error');
    return applyCorsHeaders(
      jsonResponse({ error: { message: upstreamError.message } }, upstreamError.statusCode),
      config,
    );
  });

  return app;
}
