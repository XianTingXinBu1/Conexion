import type { Preset, PromptPreset } from '../../src/types';
import { DEFAULT_API_PRESETS, DEFAULT_PROMPT_PRESETS, DEFAULTS, MAX_STOP_SEQUENCES } from '../../src/constants';
import type { AppStorage } from '../storage/appStorage';

/**
 * 解析预设的上下文窗口上限（token 数）。
 *
 * 早期版本把同一个概念存在 `maxTokens` 上，与 `contextLength` 重叠，导致
 * 「UI 改了但聊天页上限不变」。现在 `contextLength` 是唯一来源，读写都经这里归一；
 * 只有旧字段的数据会被迁移过来，两个字段同时存在时以 `contextLength` 为准。
 */
export function resolveContextLength(contextLength: unknown, legacyMaxTokens: unknown): number {
  if (typeof contextLength === 'number' && Number.isFinite(contextLength)) {
    return contextLength;
  }

  if (typeof legacyMaxTokens === 'number' && Number.isFinite(legacyMaxTokens)) {
    return legacyMaxTokens;
  }

  return DEFAULTS.CONTEXT_LENGTH;
}

/** 只接受有限数字，其余（undefined / null / NaN / 字符串）一律回退到默认值。 */
export function resolveFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/**
 * 归一化停止序列：只接受字符串、丢掉空串、按 [OI] 上限截断。
 *
 * 旧数据里这个字段可能不存在，必须回退成 `[]` 而不是 `undefined`，
 * 否则表单的 textarea 会绑到 undefined 上。
 */
export function resolveStopSequences(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === 'string' && item !== '')
    .slice(0, MAX_STOP_SEQUENCES);
}

/**
 * 归一化随机种子。
 *
 * 未设置时必须保持 `undefined`，不能退化成 `0`——`0` 是「固定种子」，
 * 会让原本应该每次都不同的输出变得可复现。
 */
export function resolveSeed(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : undefined;
}

/**
 * 归一化预设：补上必填字段，并丢掉已废弃的 `maxTokens`。
 *
 * 磁盘上的旧数据可能缺字段（`maxTokens` 时代的预设没有采样参数），
 * 不迁移就会读成 undefined，让上限/采样参数静默回退或直接坏掉。
 */
export function normalizeApiPreset(preset: Preset): Preset {
  const { maxTokens: legacyMaxTokens, ...rest } = preset as Preset & { maxTokens?: unknown };

  return {
    ...rest,
    temperature: resolveFiniteNumber(preset.temperature, DEFAULTS.TEMPERATURE),
    topP: resolveFiniteNumber(preset.topP, DEFAULTS.TOP_P),
    frequencyPenalty: resolveFiniteNumber(preset.frequencyPenalty, DEFAULTS.FREQUENCY_PENALTY),
    presencePenalty: resolveFiniteNumber(preset.presencePenalty, DEFAULTS.PRESENCE_PENALTY),
    stopSequences: resolveStopSequences(preset.stopSequences),
    seed: resolveSeed(preset.seed),
    contextLength: resolveContextLength(preset.contextLength, legacyMaxTokens),
  };
}

const cloneApiPreset = (preset: Preset): Preset => normalizeApiPreset({ ...preset });
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
