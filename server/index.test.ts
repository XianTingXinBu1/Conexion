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
});
