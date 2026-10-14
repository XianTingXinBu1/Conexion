import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { JsonFileStore } from './jsonFileStore';

it('allows a subsequent save after a filesystem write fails', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'conexion-store-'));
  const path = join(dir, 'data.json');
  try {
    await mkdir(path);
    const store = new JsonFileStore(path, () => ({ value: '' }));
    await expect(store.write({ value: '失败' })).rejects.toThrow();
    await rm(path, { recursive: true });
    await store.write({ value: '重试成功' });
    expect(await store.read()).toEqual({ value: '重试成功' });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
