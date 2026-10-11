import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { AICharacter, Conversation, Message } from '../../src/types';
import { createAppStorage, type AppStorage } from '../storage/appStorage';
import type { ServerConfig } from '../config';
import { ConversationRepository } from './conversationRepository';

const character: AICharacter = {
  id: 'char-1',
  name: 'Assistant',
  description: '',
  personality: '',
  createdAt: 1,
};

function message(id: string, content = id): Message {
  return { id, type: 'user', content, timestamp: 1 };
}

function makeConfig(dataDir: string): ServerConfig {
  return {
    host: '127.0.0.1',
    port: 0,
    clientOrigin: 'http://127.0.0.1:3100',
    defaultUpstreamBaseUrl: '',
    defaultUpstreamApiKey: '',
    upstreamTimeoutMs: 60000,
    maxBodyBytes: 1024 * 1024,
    dataDir,
  };
}

describe('ConversationRepository', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.map(dir => rm(dir, { recursive: true, force: true })));
    tempDirs.length = 0;
  });

  async function createRepository(): Promise<{ repository: ConversationRepository; storage: AppStorage }> {
    const dataDir = await mkdtemp(join(tmpdir(), 'conexion-repo-'));
    tempDirs.push(dataDir);
    const storage = createAppStorage(makeConfig(dataDir));
    return { repository: new ConversationRepository(storage), storage };
  }

  it('create without character returns a non-persisted temporary conversation', async () => {
    const { repository, storage } = await createRepository();

    const created = await repository.create(message('m1'));
    expect(created.id).toMatch(/^temp-/);

    // 临时会话不落盘
    await expect(storage.conversations.read()).resolves.toEqual([]);
    expect(await repository.get(created.id)).toBeUndefined();
  });

  it('create with character persists a conv- conversation', async () => {
    const { repository, storage } = await createRepository();

    const created = await repository.create(message('m1', 'hello world'), character);
    expect(created.id).toMatch(/^conv-/);
    expect(created.characterId).toBe('char-1');
    expect(created.title).toBe('hello world');

    const persisted = await storage.conversations.read();
    expect(persisted).toHaveLength(1);
    expect(persisted[0]!.id).toBe(created.id);
  });

  it('editMessage updates content and refreshes updatedAt', async () => {
    const { repository } = await createRepository();
    const created = await repository.create(message('m1', 'first'), character);

    const updated = await repository.editMessage(created.id, 'm1', 'edited');
    expect(updated?.messages[0]!.content).toBe('edited');
    expect(updated?.messages[0]!.id).toBe('m1');
    expect(updated?.updatedAt).toBeGreaterThanOrEqual(created.updatedAt);
  });

  it('editMessage returns undefined for temporary conversations and unknown ids', async () => {
    const { repository } = await createRepository();
    const temporary = await repository.create(message('m1'));

    expect(await repository.editMessage(temporary.id, 'm1', 'x')).toBeUndefined();
    expect(await repository.editMessage('conv-does-not-exist', 'm1', 'x')).toBeUndefined();
  });

  it('editMessage returns undefined when the target message is missing', async () => {
    const { repository } = await createRepository();
    const created = await repository.create(message('m1'), character);

    expect(await repository.editMessage(created.id, 'missing', 'x')).toBeUndefined();
  });

  it('editMessage clears compression when editing a compressed source message', async () => {
    const { repository } = await createRepository();
    const created = await repository.create(message('m1'), character);

    const compressed: Conversation = {
      ...created,
      compressed: true,
      compression: {
        compressedAt: 2,
        summaryContent: 'summary',
        promptContent: 'prompt',
        sourceMessageCount: 1,
        sourceMessageIds: ['m1'],
        keepRecentCount: 1,
      },
    };
    await repository.update(created.id, compressed);

    const withoutCompression = await repository.editMessage(created.id, 'm1', 'edited');
    expect(withoutCompression?.compressed).toBe(false);
    expect(withoutCompression?.compression).toBeUndefined();
  });

  it('editMessage keeps compression when editing an unrelated message', async () => {
    const { repository } = await createRepository();
    const created = await repository.create(message('m1'), character);
    await repository.updateMessages(created.id, [message('m1'), message('m2')]);

    await repository.update(created.id, {
      compressed: true,
      compression: {
        compressedAt: 2,
        summaryContent: 'summary',
        promptContent: 'prompt',
        sourceMessageCount: 1,
        sourceMessageIds: ['m1'],
        keepRecentCount: 1,
      },
    });

    const updated = await repository.editMessage(created.id, 'm2', 'edited m2');
    expect(updated?.compressed).toBe(true);
    expect(updated?.compression).toBeDefined();
  });

  it('deleteMessage removes the message and clears compression when it was a source', async () => {
    const { repository } = await createRepository();
    const created = await repository.create(message('m1'), character);
    await repository.updateMessages(created.id, [message('m1'), message('m2')]);
    await repository.update(created.id, {
      compressed: true,
      compression: {
        compressedAt: 2,
        summaryContent: 'summary',
        promptContent: 'prompt',
        sourceMessageCount: 1,
        sourceMessageIds: ['m1'],
        keepRecentCount: 1,
      },
    });

    const updated = await repository.deleteMessage(created.id, 'm1');
    expect(updated?.messages.map(m => m.id)).toEqual(['m2']);
    expect(updated?.compressed).toBe(false);
    expect(updated?.compression).toBeUndefined();
  });

  it('deleteMessage returns undefined when the message is not found', async () => {
    const { repository } = await createRepository();
    const created = await repository.create(message('m1'), character);

    expect(await repository.deleteMessage(created.id, 'missing')).toBeUndefined();
  });

  it('delete reports whether a persisted conversation was removed', async () => {
    const { repository } = await createRepository();
    const created = await repository.create(message('m1'), character);

    expect(await repository.delete(created.id)).toBe(true);
    expect(await repository.get(created.id)).toBeUndefined();
    expect(await repository.delete(created.id)).toBe(false);
  });

  it('update ignores temporary conversations', async () => {
    const { repository } = await createRepository();
    const temporary = await repository.create(message('m1'));

    expect(await repository.update(temporary.id, { title: 'x' })).toBeUndefined();
  });
});
