import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { getServerConfig } from '../config';
import { createAppStorage } from '../storage/appStorage';
import { SettingsRepository } from './settingsRepository';
import { DEFAULT_REGEX_SCRIPTS } from '../../src/constants';

it('preserves concurrent draft/settings updates and an intentionally empty regex list', async () => {
  const dataDir = await mkdtemp(join(tmpdir(), 'conexion-settings-'));
  try {
    const repository = new SettingsRepository(createAppStorage({ ...getServerConfig(), dataDir }));
    expect(await repository.listRegexRules()).toEqual(DEFAULT_REGEX_SCRIPTS);
    await repository.replaceRegexRules([]);
    expect(await repository.listRegexRules()).toEqual([]);
    await Promise.all([
      repository.set('chatDraft:one', '第一条草稿'),
      repository.set('chatDraft:two', '第二条草稿'),
      repository.set('enterToSend', true),
    ]);
    expect(await repository.getAll()).toEqual({ 'chatDraft:one': '第一条草稿', 'chatDraft:two': '第二条草稿', enterToSend: true });
  } finally {
    await rm(dataDir, { recursive: true, force: true });
  }
});
