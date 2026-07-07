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

  app.notFound(() => jsonResponse({ error: { message: 'Not Found' } }, 404));

  app.onError((error, _c) => {
    if (isHttpError(error)) {
      return jsonResponse({ error: { message: error.message } }, error.statusCode);
    }

    const upstreamError = mapUpstreamError(error, 'Internal Server Error');
    return jsonResponse({ error: { message: upstreamError.message } }, upstreamError.statusCode);
  });

  return app;
}
