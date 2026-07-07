import type { RegexRule } from '../../src/types';
import { DEFAULT_REGEX_SCRIPTS } from '../../src/constants';
import type { AppStorage } from '../storage/appStorage';

export class SettingsRepository {
  private readonly storage: AppStorage;

  constructor(storage: AppStorage) {
    this.storage = storage;
  }

  async getAll(): Promise<Record<string, unknown>> {
    const settings = await this.storage.settings.read();
    return settings && typeof settings === 'object' && !Array.isArray(settings) ? { ...settings } : {};
  }

  async get<T>(key: string, defaultValue: T): Promise<T> {
    const settings = await this.getAll();
    return Object.prototype.hasOwnProperty.call(settings, key) ? settings[key] as T : defaultValue;
  }

  async set<T>(key: string, value: T): Promise<T> {
    const settings = await this.getAll();
    settings[key] = value;
    await this.storage.settings.write(settings);
    return value;
  }

  async replaceAll(settings: Record<string, unknown>): Promise<Record<string, unknown>> {
    await this.storage.settings.write({ ...settings });
    return this.getAll();
  }

  async clear(): Promise<void> {
    await Promise.all([
      this.storage.conversations.write([]),
      this.storage.userCharacters.write([]),
      this.storage.aiCharacters.write([]),
      this.storage.knowledgeBases.write([]),
      this.storage.apiPresets.write([]),
      this.storage.promptPresets.write([]),
      this.storage.regexRules.write([]),
      this.storage.settings.write({}),
    ]);
  }

  async listRegexRules(): Promise<RegexRule[]> {
    const rules = await this.storage.regexRules.read();
    return Array.isArray(rules) && rules.length > 0
      ? rules.map(rule => ({ ...rule }))
      : [...DEFAULT_REGEX_SCRIPTS].map(rule => ({ ...rule }));
  }

  async replaceRegexRules(rules: RegexRule[]): Promise<RegexRule[]> {
    const nextRules = rules.length > 0
      ? rules.map(rule => ({ ...rule }))
      : [...DEFAULT_REGEX_SCRIPTS].map(rule => ({ ...rule }));
    await this.storage.regexRules.write(nextRules);
    return nextRules.map(rule => ({ ...rule }));
  }
}
