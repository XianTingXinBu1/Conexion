import { Hono } from 'hono';
import type { ServerConfig } from '../config';
import { HttpError, mapUpstreamError } from '../errors';
import { proxyUpstreamRequest } from '../upstream/client';
import { validateUpstreamBaseUrl } from '../upstream/validation';
import { ensureObjectPayload, readJsonBody, requireNonEmptyString } from '../utils/request';

/**
 * 代理请求体。
 *
 * 除本地字段外不做逐字段建模：上游参数（`temperature`、`top_p`、`stop`、
 * `stream_options` …）一律透传，新增参数不需要改这里。
 */
interface ProxyRequestPayload extends Record<string, unknown> {
  baseURL?: unknown;
  apiKey?: unknown;
  model?: unknown;
  messages?: unknown;
  stream?: unknown;
}

function getResolvedUpstream(payload: { baseURL?: unknown; apiKey?: unknown }, config: ServerConfig) {
  const rawBaseURL = requireNonEmptyString(payload.baseURL ?? config.defaultUpstreamBaseUrl, 'baseURL');
  const baseURL = validateUpstreamBaseUrl(rawBaseURL, config);
  const apiKeySource = payload.apiKey ?? config.defaultUpstreamApiKey;
  const apiKey = typeof apiKeySource === 'string' ? apiKeySource.trim() : '';

  return { baseURL, apiKey };
}

/** GET /models 只从 query 里取 baseURL，其余字段（尤其 apiKey）一律忽略 */
function pickBaseUrlFromQuery(url: URL): Record<string, string> {
  const baseURL = url.searchParams.get('baseURL');
  return baseURL ? { baseURL } : {};
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

/**
 * 仅用于本地代理自身的字段，绝不能透传给上游。
 */
const LOCAL_ONLY_FIELDS = ['baseURL', 'apiKey'];

/**
 * 不允许透传的键：`__proto__` / `constructor` / `prototype` 这类键一旦被赋到普通对象上，
 * 会改写该对象的原型链（原型污染），而请求体完全是客户端可控的。
 */
const FORBIDDEN_BODY_KEYS = ['__proto__', 'constructor', 'prototype'];

/**
 * 构造发给上游的 chat/completions 请求体。
 *
 * 早期这里是显式白名单（model / messages / temperature / max_tokens / stream），
 * 导致前端新加的任何 [OI] 参数（`top_p`、`stop`、`stream_options`、
 * `frequency_penalty` …）都会被静默丢弃，且每加一个参数都要同步改这里。
 * 现在改为「透传 + 本地字段黑名单」：除了本地专用字段，其余原样转发。
 */
export function buildUpstreamChatBody(
  payload: Record<string, unknown>,
  model: string,
): Record<string, unknown> {
  const body: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(payload)) {
    if (LOCAL_ONLY_FIELDS.includes(key) || FORBIDDEN_BODY_KEYS.includes(key)) {
      continue;
    }
    body[key] = value;
  }

  // model 用校验过的归一值（trim 过）覆盖
  body.model = model;

  return body;
}

export function createProxyRoutes(config: ServerConfig) {
  const app = new Hono();

  app.on(['GET', 'POST'], '/models', async (c) => {
    const source = c.req.method === 'GET'
      // GET 只接受 baseURL 走 query：把 apiKey 放进 URL 会留在访问日志、浏览器历史与
      // Referer 里，需要自定义 Key 的场景请用 POST。
      ? pickBaseUrlFromQuery(new URL(c.req.url))
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

    const body = JSON.stringify(buildUpstreamChatBody(payload, model));

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
