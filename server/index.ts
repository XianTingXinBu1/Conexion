import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { URL } from 'node:url';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';

const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 3900);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://127.0.0.1:3100';
const DEFAULT_UPSTREAM_BASE_URL = process.env.DEFAULT_UPSTREAM_BASE_URL || '';
const DEFAULT_UPSTREAM_API_KEY = process.env.DEFAULT_UPSTREAM_API_KEY || '';

interface ProxyRequestPayload {
  baseURL?: string;
  apiKey?: string;
  model?: string;
  messages?: unknown;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
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

async function readJsonBody(req: IncomingMessage): Promise<any> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return {};
  }

  const raw = Buffer.concat(chunks).toString('utf-8');
  return JSON.parse(raw);
}

function getResolvedUpstream(payload: { baseURL?: string; apiKey?: string }) {
  const baseURL = (payload.baseURL || DEFAULT_UPSTREAM_BASE_URL).trim().replace(/\/$/, '');
  const apiKey = (payload.apiKey || DEFAULT_UPSTREAM_API_KEY).trim();

  if (!baseURL) {
    throw new Error('缺少上游 API URL');
  }

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
          upstreamRes.on('error', reject);
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
        upstreamRes.on('error', reject);
      },
    );

    upstreamReq.on('error', reject);

    if (options.body) {
      upstreamReq.write(options.body);
    }

    upstreamReq.end();
  });
}

async function handleModels(req: IncomingMessage, res: ServerResponse) {
  const source = req.method === 'GET'
    ? Object.fromEntries(new URL(req.url || '/', `http://${req.headers.host}`).searchParams.entries())
    : await readJsonBody(req);

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
  const payload = await readJsonBody(req);
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
    sendJson(res, 502, {
      success: false,
      latency: Date.now() - startedAt,
      error: error instanceof Error ? error.message : '连接测试失败',
    });
  }
}

async function handleChat(req: IncomingMessage, res: ServerResponse) {
  const payload = (await readJsonBody(req)) as ProxyRequestPayload;
  const { baseURL, apiKey } = getResolvedUpstream(payload);

  if (!payload.model) {
    sendJson(res, 400, { error: { message: '缺少 model' } });
    return;
  }

  if (!Array.isArray(payload.messages)) {
    sendJson(res, 400, { error: { message: '缺少 messages' } });
    return;
  }

  const body = JSON.stringify({
    model: payload.model,
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
      if (!res.headersSent) {
        sendJson(res, 502, { error: { message: error instanceof Error ? error.message : '流式请求失败' } });
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
    sendJson(res, 502, { error: { message: error instanceof Error ? error.message : '聊天请求失败' } });
  }
}

const server = createServer(async (req, res) => {
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
    sendJson(res, 500, { error: { message: error instanceof Error ? error.message : 'Internal Server Error' } });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`[server] listening on http://${HOST}:${PORT}`);
});
