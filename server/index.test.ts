import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createAppServer } from './index';
import { DEFAULTS } from '../src/constants';

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
  const tempDirs: string[] = [];

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

    await Promise.all(tempDirs.map(dir => rm(dir, { recursive: true, force: true })));
    tempDirs.length = 0;
  });

  async function useTempDataDir() {
    const dataDir = await mkdtemp(join(tmpdir(), 'conexion-test-data-'));
    tempDirs.push(dataDir);
    const previousDataDir = process.env.CONEXION_DATA_DIR;
    process.env.CONEXION_DATA_DIR = dataDir;
    return () => {
      if (previousDataDir === undefined) {
        delete process.env.CONEXION_DATA_DIR;
      } else {
        process.env.CONEXION_DATA_DIR = previousDataDir;
      }
    };
  }

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

  it('forwards [OI] parameters it does not model explicitly', async () => {
    const previous = process.env.ALLOW_PRIVATE_UPSTREAMS;
    process.env.ALLOW_PRIVATE_UPSTREAMS = 'true';

    // 假上游：记录收到的请求体
    const received: Array<Record<string, unknown>> = [];
    const upstream = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', chunk => chunks.push(chunk as Buffer));
      req.on('end', () => {
        received.push(JSON.parse(Buffer.concat(chunks).toString('utf-8')) as Record<string, unknown>);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ choices: [{ message: { role: 'assistant', content: 'ok' } }] }));
      });
    });
    await new Promise<void>(resolve => upstream.listen(0, '127.0.0.1', () => resolve()));
    const upstreamPort = (upstream.address() as { port: number }).port;

    const started = await startTestServer();
    servers.push(started.server);

    try {
      const response = await fetch(`${started.baseUrl}/api/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseURL: `http://127.0.0.1:${upstreamPort}/v1`,
          apiKey: 'sk-secret',
          model: 'test-model',
          messages: [{ role: 'user', content: 'hi' }],
          temperature: 0.7,
          max_tokens: 2048,
          stream: false,
          // 代理没有逐字段建模的参数
          top_p: 0.9,
          stop: ['\n\n'],
          stream_options: { include_usage: true },
        }),
      });

      expect(response.status).toBe(200);
      expect(received).toHaveLength(1);

      const body = received[0]!;
      expect(body).toMatchObject({
        model: 'test-model',
        temperature: 0.7,
        max_tokens: 2048,
        top_p: 0.9,
        stop: ['\n\n'],
        stream_options: { include_usage: true },
      });

      // 本地专用字段不能泄给上游
      expect(body).not.toHaveProperty('baseURL');
      expect(body).not.toHaveProperty('apiKey');
    } finally {
      await new Promise<void>(resolve => upstream.close(() => resolve()));
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

  it('persists API and prompt presets through backend JSON storage', async () => {
    const restoreDataDir = await useTempDataDir();
    const started = await startTestServer();
    servers.push(started.server);

    try {
      const apiPresets = [{
        id: 'api-1',
        name: 'API',
        url: 'https://api.example.com/v1',
        apiKey: 'key',
        model: 'model',
        streamEnabled: true,
        temperature: 0.7,
        topP: 0.9,
        frequencyPenalty: 0.3,
        presencePenalty: -0.2,
        stopSequences: ['\n\nUser:'],
        seed: 42,
        contextLength: 2048,
        maxOutputTokens: 4096,
        createdAt: 1,
        updatedAt: 1,
      }];
      const promptPresets = [{
        id: 'prompt-1',
        name: 'Prompt',
        items: [{
          id: 'item-1',
          name: 'Item',
          description: '',
          enabled: true,
          prompt: 'Hello',
          roleType: 'system',
          insertPosition: 1,
        }],
        createdAt: 1,
        updatedAt: 1,
      }];

      const apiSaveResponse = await fetch(`${started.baseUrl}/api/api-presets`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ presets: apiPresets }),
      });
      expect(apiSaveResponse.status).toBe(200);

      const promptSaveResponse = await fetch(`${started.baseUrl}/api/prompt-presets`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ presets: promptPresets }),
      });
      expect(promptSaveResponse.status).toBe(200);

      await expect(fetch(`${started.baseUrl}/api/api-presets`).then(res => res.json())).resolves.toEqual(apiPresets);
      await expect(fetch(`${started.baseUrl}/api/prompt-presets`).then(res => res.json())).resolves.toEqual(promptPresets);
    } finally {
      restoreDataDir();
    }
  });

  it('fills defaults for legacy API presets missing sampling fields', async () => {
    const restoreDataDir = await useTempDataDir();
    const started = await startTestServer();
    servers.push(started.server);

    try {
      // 旧格式：只有 maxTokens，没有 contextLength，也没有任何采样参数。
      const legacyPresets = [{
        id: 'legacy-1',
        name: 'Legacy',
        url: 'https://api.example.com/v1',
        apiKey: '',
        model: 'model',
        streamEnabled: true,
        temperature: 0.5,
        maxTokens: 8192,
        maxOutputTokens: 4096,
        createdAt: 1,
        updatedAt: 1,
      }];

      const saveResponse = await fetch(`${started.baseUrl}/api/api-presets`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ presets: legacyPresets }),
      });
      expect(saveResponse.status).toBe(200);

      const [saved] = await fetch(`${started.baseUrl}/api/api-presets`).then(res => res.json());

      // maxTokens 迁移到 contextLength 后应被丢弃，采样参数补默认值。
      expect(saved.contextLength).toBe(8192);
      expect(saved.maxTokens).toBeUndefined();
      expect(saved.topP).toBe(DEFAULTS.TOP_P);
      expect(saved.frequencyPenalty).toBe(DEFAULTS.FREQUENCY_PENALTY);
      expect(saved.presencePenalty).toBe(DEFAULTS.PRESENCE_PENALTY);
      expect(saved.stopSequences).toEqual([]);
      expect(saved.seed).toBeUndefined();
    } finally {
      restoreDataDir();
    }
  });

  it('migrates legacy maxTokens to contextLength on read and write', async () => {
    const restoreDataDir = await useTempDataDir();
    const started = await startTestServer();
    servers.push(started.server);

    try {
      // 旧客户端/旧数据只有 maxTokens，没有 contextLength。
      const legacyPreset = {
        id: 'legacy-1',
        name: 'Legacy',
        url: 'https://api.example.com/v1',
        apiKey: 'key',
        model: 'model',
        streamEnabled: true,
        temperature: 0.7,
        maxTokens: 100000,
        maxOutputTokens: 4096,
        createdAt: 1,
        updatedAt: 1,
      };

      const saveResponse = await fetch(`${started.baseUrl}/api/api-presets`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ presets: [legacyPreset] }),
      });
      expect(saveResponse.status).toBe(200);

      const saved = await saveResponse.json();
      expect(saved[0].contextLength).toBe(100000);
      expect(saved[0]).not.toHaveProperty('maxTokens');

      // 读路径也要归一：磁盘上可能还是旧格式。
      const reloaded = await fetch(`${started.baseUrl}/api/api-presets`).then(res => res.json());
      expect(reloaded[0].contextLength).toBe(100000);
      expect(reloaded[0]).not.toHaveProperty('maxTokens');
    } finally {
      restoreDataDir();
    }
  });

  it('prefers contextLength over legacy maxTokens when both are present', async () => {
    const restoreDataDir = await useTempDataDir();
    const started = await startTestServer();
    servers.push(started.server);

    try {
      const response = await fetch(`${started.baseUrl}/api/api-presets`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          presets: [{
            id: 'both-1',
            name: 'Both',
            url: 'https://api.example.com/v1',
            apiKey: 'key',
            model: 'model',
            streamEnabled: true,
            temperature: 0.7,
            maxTokens: 100000,
            contextLength: 8192,
            maxOutputTokens: 4096,
            createdAt: 1,
            updatedAt: 1,
          }],
        }),
      });
      expect(response.status).toBe(200);

      const saved = await response.json();
      expect(saved[0].contextLength).toBe(8192);
      expect(saved[0]).not.toHaveProperty('maxTokens');
    } finally {
      restoreDataDir();
    }
  });

  it('persists characters and knowledge bases through backend JSON storage', async () => {
    const restoreDataDir = await useTempDataDir();
    const started = await startTestServer();
    servers.push(started.server);

    try {
      const userCharacters = [{ id: 'user-1', name: 'User', description: '', createdAt: 1 }];
      const aiCharacters = [{ id: 'ai-1', name: 'AI', description: '', personality: '', knowledgeBaseId: 'kb-1', createdAt: 1 }];
      const knowledgeBases = [{ id: 'kb-1', name: 'KB', description: '', entries: [], globallyEnabled: true, createdAt: 1, updatedAt: 1 }];

      const userSaveResponse = await fetch(`${started.baseUrl}/api/characters/users`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characters: userCharacters }),
      });
      expect(userSaveResponse.status).toBe(200);

      const aiSaveResponse = await fetch(`${started.baseUrl}/api/characters/ai`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characters: aiCharacters }),
      });
      expect(aiSaveResponse.status).toBe(200);

      const kbSaveResponse = await fetch(`${started.baseUrl}/api/knowledge-bases`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ knowledgeBases }),
      });
      expect(kbSaveResponse.status).toBe(200);

      await expect(fetch(`${started.baseUrl}/api/characters/users`).then(res => res.json())).resolves.toEqual(userCharacters);
      await expect(fetch(`${started.baseUrl}/api/characters/ai`).then(res => res.json())).resolves.toEqual(aiCharacters);
      await expect(fetch(`${started.baseUrl}/api/knowledge-bases`).then(res => res.json())).resolves.toEqual(knowledgeBases);

      const clearResponse = await fetch(`${started.baseUrl}/api/characters/ai/clear-knowledge-base-reference`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ knowledgeBaseId: 'kb-1' }),
      });
      expect(clearResponse.status).toBe(200);
      await expect(clearResponse.json()).resolves.toEqual({ changed: true });

      const clearedAICharacters = await fetch(`${started.baseUrl}/api/characters/ai`).then(res => res.json());
      expect(clearedAICharacters[0].knowledgeBaseId).toBeUndefined();
    } finally {
      restoreDataDir();
    }
  });

  it('persists conversations through backend JSON storage', async () => {
    const restoreDataDir = await useTempDataDir();
    const started = await startTestServer();
    servers.push(started.server);

    try {
      const firstMessage = { id: 'msg-1', type: 'user', content: 'Hello backend', timestamp: 1 };
      const createResponse = await fetch(`${started.baseUrl}/api/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstMessage,
          character: {
            id: 'char-1',
            name: 'Assistant',
            description: 'Test assistant',
            personality: 'Helpful',
            createdAt: 1,
          },
        }),
      });

      expect(createResponse.status).toBe(201);
      const created = await createResponse.json();
      expect(created).toMatchObject({
        id: expect.stringMatching(/^conv-/),
        characterId: 'char-1',
        messages: [firstMessage],
      });

      const updateResponse = await fetch(`${started.baseUrl}/api/conversations/${created.id}/messages`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            firstMessage,
            { id: 'msg-2', type: 'assistant', content: 'Hi', timestamp: 2 },
          ],
        }),
      });

      expect(updateResponse.status).toBe(200);
      const updated = await updateResponse.json();
      expect(updated.messages).toHaveLength(2);

      const listResponse = await fetch(`${started.baseUrl}/api/conversations`);
      expect(listResponse.status).toBe(200);
      const conversations = await listResponse.json();
      expect(conversations).toHaveLength(1);
      expect(conversations[0].messages).toHaveLength(2);
    } finally {
      restoreDataDir();
    }
  });
});
