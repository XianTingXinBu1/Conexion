import { afterEach, describe, expect, it } from 'vitest';
import { createAppServer } from './index';

async function startTestServer() {
  const server = createAppServer();

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Failed to get server address');
  }

  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
  };
}

describe('server api validation', () => {
  const servers: Array<ReturnType<typeof createAppServer>> = [];

  afterEach(async () => {
    await Promise.all(
      servers.map(server => new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      }))
    );
    servers.length = 0;
  });

  it('returns 400 for malformed JSON', async () => {
    const started = await startTestServer();
    servers.push(started.server);

    const response = await fetch(`${started.baseUrl}/api/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{bad json',
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: { message: 'malformed JSON' },
    });
  });

  it('returns 400 for missing required chat fields', async () => {
    const started = await startTestServer();
    servers.push(started.server);

    const response = await fetch(`${started.baseUrl}/api/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-test', messages: [] }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: { message: '缺少 baseURL' },
    });
  });

  it('rejects private upstream baseURL values when private upstreams are disabled', async () => {
    const previous = process.env.ALLOW_PRIVATE_UPSTREAMS;
    process.env.ALLOW_PRIVATE_UPSTREAMS = 'false';
    const started = await startTestServer();
    servers.push(started.server);

    try {
      for (const baseURL of ['http://127.0.0.1:11434/v1', 'http://[::1]:11434/v1', 'http://[::ffff:127.0.0.1]:11434/v1']) {
        const response = await fetch(`${started.baseUrl}/api/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            baseURL,
            model: 'gpt-test',
            messages: [],
          }),
        });

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toEqual({
          error: { message: 'baseURL 不允许指向本机或内网地址' },
        });
      }
    } finally {
      if (previous === undefined) {
        delete process.env.ALLOW_PRIVATE_UPSTREAMS;
      } else {
        process.env.ALLOW_PRIVATE_UPSTREAMS = previous;
      }
    }
  });

  it('returns 413 for oversized JSON bodies', async () => {
    const started = await startTestServer();
    servers.push(started.server);

    const response = await fetch(`${started.baseUrl}/api/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ padding: 'x'.repeat(1024 * 1024 + 1) }),
    });

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toEqual({
      error: { message: '请求体过大' },
    });
  });
});
