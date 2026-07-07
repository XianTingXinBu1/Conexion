import type { Preset, PromptPreset } from '../../src/types';
import { DEFAULT_API_PRESETS, DEFAULT_PROMPT_PRESETS } from '../../src/constants';
import type { AppStorage } from '../storage/appStorage';

const cloneApiPreset = (preset: Preset): Preset => ({ ...preset });
const clonePromptPreset = (preset: PromptPreset): PromptPreset => ({
  ...preset,
  items: preset.items.map(item => ({ ...item })),
});
const cloneDefaultPromptPresets = (): PromptPreset[] => (
  DEFAULT_PROMPT_PRESETS as unknown as PromptPreset[]
).map(clonePromptPreset);

export class ApiPresetRepository {
  private readonly storage: AppStorage;

  constructor(storage: AppStorage) {
    this.storage = storage;
  }

  async list(): Promise<Preset[]> {
    const presets = await this.storage.apiPresets.read();
    return Array.isArray(presets) && presets.length > 0
      ? presets.map(cloneApiPreset)
      : [...DEFAULT_API_PRESETS].map(cloneApiPreset);
  }

  async replaceAll(presets: Preset[]): Promise<Preset[]> {
    const nextPresets = presets.length > 0
      ? presets.map(cloneApiPreset)
      : [...DEFAULT_API_PRESETS].map(cloneApiPreset);
    await this.storage.apiPresets.write(nextPresets);
    return nextPresets.map(cloneApiPreset);
  }
}

export class PromptPresetRepository {
  private readonly storage: AppStorage;

  constructor(storage: AppStorage) {
    this.storage = storage;
  }

  async list(): Promise<PromptPreset[]> {
    const presets = await this.storage.promptPresets.read();
    return Array.isArray(presets) && presets.length > 0
      ? presets.map(clonePromptPreset)
      : cloneDefaultPromptPresets();
  }

  async replaceAll(presets: PromptPreset[]): Promise<PromptPreset[]> {
    const nextPresets = presets.length > 0
      ? presets.map(clonePromptPreset)
      : cloneDefaultPromptPresets();
    await this.storage.promptPresets.write(nextPresets);
    return nextPresets.map(clonePromptPreset);
  }
}
