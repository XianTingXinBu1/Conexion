import { Hono } from 'hono';
import type { ServerConfig } from '../config';
import { HttpError, mapUpstreamError } from '../errors';
import { proxyUpstreamRequest } from '../upstream/client';
import { validateUpstreamBaseUrl } from '../upstream/validation';
import { ensureObjectPayload, readJsonBody, requireNonEmptyString } from '../utils/request';

interface ProxyRequestPayload {
  baseURL?: unknown;
  apiKey?: unknown;
  model?: unknown;
  messages?: unknown;
  temperature?: unknown;
  max_tokens?: unknown;
  stream?: unknown;
}

function getResolvedUpstream(payload: { baseURL?: unknown; apiKey?: unknown }, config: ServerConfig) {
  const rawBaseURL = requireNonEmptyString(payload.baseURL ?? config.defaultUpstreamBaseUrl, 'baseURL');
  const baseURL = validateUpstreamBaseUrl(rawBaseURL, config);
  const apiKeySource = payload.apiKey ?? config.defaultUpstreamApiKey;
  const apiKey = typeof apiKeySource === 'string' ? apiKeySource.trim() : '';

  return { baseURL, apiKey };
}

function jsonResponse(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function responseHeadersFromUpstream(upstreamHeaders: Headers, fallbackContentType: string): HeadersInit {
  return {
    'Content-Type': upstreamHeaders.get('content-type') || fallbackContentType,
  };
}

function streamHeadersFromUpstream(upstreamHeaders: Headers): HeadersInit {
  return {
    'Content-Type': upstreamHeaders.get('content-type') || 'text/event-stream; charset=utf-8',
    'Cache-Control': upstreamHeaders.get('cache-control') || 'no-cache',
    Connection: 'keep-alive',
  };
}

export function createProxyRoutes(config: ServerConfig) {
  const app = new Hono();

  app.on(['GET', 'POST'], '/models', async (c) => {
    const source = c.req.method === 'GET'
      ? Object.fromEntries(new URL(c.req.url).searchParams.entries())
      : ensureObjectPayload(await readJsonBody(c.req.raw, config.maxBodyBytes));

    const { baseURL, apiKey } = getResolvedUpstream(source, config);
    const result = await proxyUpstreamRequest({
      method: 'GET',
      upstreamUrl: `${baseURL}/models`,
      apiKey,
      timeoutMs: config.upstreamTimeoutMs,
    });

    return new Response(result.body || '{}', {
      status: result.status,
      headers: responseHeadersFromUpstream(result.headers, 'application/json; charset=utf-8'),
    });
  });

  app.post('/connection-test', async (c) => {
    const payload = ensureObjectPayload(await readJsonBody(c.req.raw, config.maxBodyBytes));
    const startedAt = Date.now();
    const { baseURL, apiKey } = getResolvedUpstream(payload, config);

    try {
      const result = await proxyUpstreamRequest({
        method: 'GET',
        upstreamUrl: `${baseURL}/models`,
        apiKey,
        timeoutMs: config.upstreamTimeoutMs,
      });

      return jsonResponse({
        success: result.status >= 200 && result.status < 300,
        latency: Date.now() - startedAt,
      }, result.status >= 200 && result.status < 300 ? 200 : result.status);
    } catch (error) {
      const upstreamError = mapUpstreamError(error, '连接测试失败');
      return jsonResponse({
        success: false,
        latency: Date.now() - startedAt,
        error: upstreamError.message,
      }, upstreamError.statusCode);
    }
  });

  app.post('/chat/completions', async (c) => {
    const payload = ensureObjectPayload(await readJsonBody(c.req.raw, config.maxBodyBytes)) as ProxyRequestPayload;
    const { baseURL, apiKey } = getResolvedUpstream(payload, config);
    const model = requireNonEmptyString(payload.model, 'model');

    if (!Array.isArray(payload.messages)) {
      throw new HttpError(400, '缺少 messages');
    }

    const body = JSON.stringify({
      model,
      messages: payload.messages,
      temperature: payload.temperature,
      max_tokens: payload.max_tokens,
      stream: payload.stream,
    });

    if (payload.stream) {
      try {
        const result = await proxyUpstreamRequest({
          method: 'POST',
          upstreamUrl: `${baseURL}/chat/completions`,
          apiKey,
          body,
          timeoutMs: config.upstreamTimeoutMs,
          stream: true,
        });

        return new Response(result.stream, {
          status: result.status,
          headers: streamHeadersFromUpstream(result.headers),
        });
      } catch (error) {
        const upstreamError = mapUpstreamError(error, '流式请求失败');
        return jsonResponse({ error: { message: upstreamError.message } }, upstreamError.statusCode);
      }
    }

    try {
      const result = await proxyUpstreamRequest({
        method: 'POST',
        upstreamUrl: `${baseURL}/chat/completions`,
        apiKey,
        body,
        timeoutMs: config.upstreamTimeoutMs,
      });

      return new Response(result.body || '{}', {
        status: result.status,
        headers: responseHeadersFromUpstream(result.headers, 'application/json; charset=utf-8'),
      });
    } catch (error) {
      const upstreamError = mapUpstreamError(error, '聊天请求失败');
      return jsonResponse({ error: { message: upstreamError.message } }, upstreamError.statusCode);
    }
  });

  return app;
}
