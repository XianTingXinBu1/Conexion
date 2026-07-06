import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { URL, fileURLToPath } from 'node:url';

const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 3900);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://127.0.0.1:3100';
const DEFAULT_UPSTREAM_BASE_URL = process.env.DEFAULT_UPSTREAM_BASE_URL || '';
const DEFAULT_UPSTREAM_API_KEY = process.env.DEFAULT_UPSTREAM_API_KEY || '';
const UPSTREAM_TIMEOUT_MS = Number(process.env.UPSTREAM_TIMEOUT_MS || 60000);

interface ProxyRequestPayload {
  baseURL?: string;
  apiKey?: string;
  model?: string;
  messages?: unknown;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

class HttpError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = 'HttpError';
  }
}

class UpstreamRequestError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = 'UpstreamRequestError';
  }
}

function setCorsHeaders(res: ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', CLIENT_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function sendJson(res: ServerResponse, statusCode: number, data: unknown) {
  setCorsHeaders(res);
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function sendText(res: ServerResponse, statusCode: number, message: string) {
  setCorsHeaders(res);
  res.writeHead(statusCode, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(message);
}

function isHttpError(error: unknown): error is HttpError {
  return error instanceof HttpError;
}

function isUpstreamRequestError(error: unknown): error is UpstreamRequestError {
  return error instanceof UpstreamRequestError;
}

function mapUpstreamError(error: unknown, fallbackMessage: string): UpstreamRequestError {
  if (isUpstreamRequestError(error)) {
    return error;
  }

  if (error instanceof Error) {
    const code = 'code' in error && typeof error.code === 'string' ? error.code : '';
    if (code === 'ETIMEDOUT' || code === 'ESOCKETTIMEDOUT' || code === 'UND_ERR_CONNECT_TIMEOUT') {
      return new UpstreamRequestError(504, error.message || '上游请求超时');
    }
    return new UpstreamRequestError(502, error.message || fallbackMessage);
  }

  return new UpstreamRequestError(502, fallbackMessage);
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return {};
  }

  const raw = Buffer.concat(chunks).toString('utf-8');

  try {
    return JSON.parse(raw);
  } catch {
    throw new HttpError(400, 'malformed JSON');
  }
}

function ensureObjectPayload(payload: unknown): Record<string, unknown> {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    throw new HttpError(400, '请求体必须是 JSON 对象');
  }

  return payload as Record<string, unknown>;
}

function requireNonEmptyString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new HttpError(400, `缺少 ${fieldName}`);
  }

  return value.trim();
}

function getResolvedUpstream(payload: { baseURL?: unknown; apiKey?: unknown }) {
  const baseURL = requireNonEmptyString(payload.baseURL ?? DEFAULT_UPSTREAM_BASE_URL, 'baseURL').replace(/\/$/, '');
  const apiKeySource = payload.apiKey ?? DEFAULT_UPSTREAM_API_KEY;
  const apiKey = typeof apiKeySource === 'string' ? apiKeySource.trim() : '';

  return { baseURL, apiKey };
}

function proxyRequest(options: {
  method: 'GET' | 'POST' | 'HEAD';
  upstreamUrl: string;
  apiKey?: string;
  body?: string;
  streamToClient?: ServerResponse;
}): Promise<{ status: number; body?: string; headers: Record<string, string | string[] | undefined> }> {
  const url = new URL(options.upstreamUrl);
  const requestFn = url.protocol === 'https:' ? httpsRequest : httpRequest;

  return new Promise((resolve, reject) => {
    const upstreamReq = requestFn(
      url,
      {
        method: options.method,
        headers: {
          'Content-Type': 'application/json',
          ...(options.apiKey ? { Authorization: `Bearer ${options.apiKey}` } : {}),
        },
      },
      (upstreamRes) => {
        if (options.streamToClient) {
          setCorsHeaders(options.streamToClient);
          options.streamToClient.writeHead(upstreamRes.statusCode || 500, {
            'Content-Type': upstreamRes.headers['content-type'] || 'text/event-stream; charset=utf-8',
            'Cache-Control': upstreamRes.headers['cache-control'] || 'no-cache',
            Connection: 'keep-alive',
          });

          upstreamRes.on('data', (chunk) => options.streamToClient?.write(chunk));
          upstreamRes.on('end', () => {
            options.streamToClient?.end();
            resolve({ status: upstreamRes.statusCode || 200, headers: upstreamRes.headers as Record<string, string | string[] | undefined> });
          });
          upstreamRes.on('error', (error) => reject(mapUpstreamError(error, '流式上游响应失败')));
          return;
        }

        const chunks: Buffer[] = [];
        upstreamRes.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        upstreamRes.on('end', () => {
          resolve({
            status: upstreamRes.statusCode || 500,
            body: Buffer.concat(chunks).toString('utf-8'),
            headers: upstreamRes.headers as Record<string, string | string[] | undefined>,
          });
        });
        upstreamRes.on('error', (error) => reject(mapUpstreamError(error, '上游响应失败')));
      },
    );

    upstreamReq.setTimeout(UPSTREAM_TIMEOUT_MS, () => {
      upstreamReq.destroy(new UpstreamRequestError(504, '上游请求超时'));
    });

    upstreamReq.on('error', (error) => reject(mapUpstreamError(error, '上游请求失败')));

    if (options.body) {
      upstreamReq.write(options.body);
    }

    upstreamReq.end();
  });
}

async function handleModels(req: IncomingMessage, res: ServerResponse) {
  const source = req.method === 'GET'
    ? Object.fromEntries(new URL(req.url || '/', `http://${req.headers.host}`).searchParams.entries())
    : ensureObjectPayload(await readJsonBody(req));

  const { baseURL, apiKey } = getResolvedUpstream(source);
  const result = await proxyRequest({
    method: 'GET',
    upstreamUrl: `${baseURL}/models`,
    apiKey,
  });

  setCorsHeaders(res);
  res.writeHead(result.status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(result.body || '{}');
}

async function handleConnectionTest(req: IncomingMessage, res: ServerResponse) {
  const payload = ensureObjectPayload(await readJsonBody(req));
  const startedAt = Date.now();
  const { baseURL, apiKey } = getResolvedUpstream(payload);

  try {
    const result = await proxyRequest({
      method: 'GET',
      upstreamUrl: `${baseURL}/models`,
      apiKey,
    });

    sendJson(res, result.status >= 200 && result.status < 300 ? 200 : result.status, {
      success: result.status >= 200 && result.status < 300,
      latency: Date.now() - startedAt,
    });
  } catch (error) {
    const upstreamError = mapUpstreamError(error, '连接测试失败');
    sendJson(res, upstreamError.statusCode, {
      success: false,
      latency: Date.now() - startedAt,
      error: upstreamError.message,
    });
  }
}

async function handleChat(req: IncomingMessage, res: ServerResponse) {
  const payload = ensureObjectPayload(await readJsonBody(req)) as ProxyRequestPayload;
  const { baseURL, apiKey } = getResolvedUpstream(payload);
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
      await proxyRequest({
        method: 'POST',
        upstreamUrl: `${baseURL}/chat/completions`,
        apiKey,
        body,
        streamToClient: res,
      });
    } catch (error) {
      const upstreamError = mapUpstreamError(error, '流式请求失败');
      if (!res.headersSent) {
        sendJson(res, upstreamError.statusCode, { error: { message: upstreamError.message } });
      } else {
        res.end();
      }
    }
    return;
  }

  try {
    const result = await proxyRequest({
      method: 'POST',
      upstreamUrl: `${baseURL}/chat/completions`,
      apiKey,
      body,
    });

    setCorsHeaders(res);
    res.writeHead(result.status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(result.body || '{}');
  } catch (error) {
    const upstreamError = mapUpstreamError(error, '聊天请求失败');
    sendJson(res, upstreamError.statusCode, { error: { message: upstreamError.message } });
  }
}

export function createAppServer() {
  return createServer(async (req, res) => {
    try {
      if (!req.url || !req.method) {
        sendText(res, 400, 'Bad Request');
        return;
      }

      if (req.method === 'OPTIONS') {
        setCorsHeaders(res);
        res.writeHead(204);
        res.end();
        return;
      }

      const url = new URL(req.url, `http://${req.headers.host}`);

      if (req.method === 'GET' && url.pathname === '/api/health') {
        sendJson(res, 200, { ok: true });
        return;
      }

      if ((req.method === 'GET' || req.method === 'POST') && url.pathname === '/api/models') {
        await handleModels(req, res);
        return;
      }

      if (req.method === 'POST' && url.pathname === '/api/connection-test') {
        await handleConnectionTest(req, res);
        return;
      }

      if (req.method === 'POST' && url.pathname === '/api/chat/completions') {
        await handleChat(req, res);
        return;
      }

      sendJson(res, 404, { error: { message: 'Not Found' } });
    } catch (error) {
      if (isHttpError(error)) {
        sendJson(res, error.statusCode, { error: { message: error.message } });
        return;
      }

      const upstreamError = mapUpstreamError(error, 'Internal Server Error');
      sendJson(res, upstreamError.statusCode, { error: { message: upstreamError.message } });
    }
  });
}

export function startServer() {
  const server = createAppServer();
  server.listen(PORT, HOST, () => {
    console.log(`[server] listening on http://${HOST}:${PORT}`);
  });
  return server;
}

const entryPath = process.argv[1] ? fileURLToPath(import.meta.url) === process.argv[1] : false;
if (entryPath) {
  startServer();
}
