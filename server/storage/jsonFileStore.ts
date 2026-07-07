import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { JsonDataStore } from './types';

export class JsonFileStore<T> implements JsonDataStore<T> {
  private pendingWrite: Promise<void> = Promise.resolve();
  private readonly filePath: string;
  private readonly defaultValue: () => T;

  constructor(filePath: string, defaultValue: () => T) {
    this.filePath = filePath;
    this.defaultValue = defaultValue;
  }

  async read(): Promise<T> {
    try {
      const raw = await readFile(this.filePath, 'utf-8');
      return JSON.parse(raw) as T;
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
        return this.defaultValue();
      }

      throw error;
    }
  }

  async write(data: T): Promise<void> {
    this.pendingWrite = this.pendingWrite.then(() => this.writeImmediately(data));
    return this.pendingWrite;
  }

  private async writeImmediately(data: T): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    const tempPath = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(tempPath, `${JSON.stringify(data, null, 2)}\n`, 'utf-8');
    await rename(tempPath, this.filePath);
  }
}
