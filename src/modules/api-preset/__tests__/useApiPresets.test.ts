// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Preset } from '@/types';

const loadApiPresetsWithDefaults = vi.fn();
const loadSelectedApiPresetId = vi.fn();
const saveApiPresets = vi.fn();
const saveSelectedApiPresetId = vi.fn();

vi.mock('@/repositories/apiPresetRepository', () => ({
  loadApiPresetsWithDefaults: () => loadApiPresetsWithDefaults(),
  loadSelectedApiPresetId: () => loadSelectedApiPresetId(),
  saveApiPresets: (presets: Preset[]) => saveApiPresets(presets),
  saveSelectedApiPresetId: (id: string) => saveSelectedApiPresetId(id),
}));

const { useApiPresets } = await import('../useApiPresets');

function buildPreset(overrides: Partial<Preset> & Pick<Preset, 'id'>): Preset {
  return {
    name: overrides.id,
    url: 'https://example.com/v1',
    apiKey: '',
    model: 'model',
    streamEnabled: true,
    temperature: 0.7,
    topP: 1,
    frequencyPenalty: 0,
    presencePenalty: 0,
    stopSequences: [],
    contextLength: 2048,
    maxOutputTokens: 4096,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

describe('useApiPresets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    saveApiPresets.mockResolvedValue(undefined);
    saveSelectedApiPresetId.mockResolvedValue(undefined);
  });

  it('loadPresets 会一并同步后端记住的选中预设', async () => {
    loadApiPresetsWithDefaults.mockResolvedValue([
      buildPreset({ id: 'default', contextLength: 2048 }),
      buildPreset({ id: 'ds', contextLength: 1000 }),
    ]);
    loadSelectedApiPresetId.mockResolvedValue('ds');

    const { loadPresets, selectedPreset, currentPreset } = useApiPresets();
    await loadPresets();

    expect(selectedPreset.value).toBe('ds');
    expect(currentPreset.value?.contextLength).toBe(1000);
  });

  it('选中项不存在时回退到第一个预设并写回设置', async () => {
    loadApiPresetsWithDefaults.mockResolvedValue([
      buildPreset({ id: 'first', contextLength: 1234 }),
      buildPreset({ id: 'second' }),
    ]);
    loadSelectedApiPresetId.mockResolvedValue('missing');

    const { loadPresets, selectedPreset, currentPreset } = useApiPresets();
    await loadPresets();

    expect(selectedPreset.value).toBe('first');
    expect(currentPreset.value?.contextLength).toBe(1234);
    expect(saveSelectedApiPresetId).toHaveBeenCalledWith('first');
  });

  it('saveCurrentPreset 把表单里的 contextLength 写回预设（上下文上限的唯一来源）', async () => {
    loadApiPresetsWithDefaults.mockResolvedValue([
      buildPreset({ id: 'default', contextLength: 8192, temperature: 0.7 }),
    ]);
    loadSelectedApiPresetId.mockResolvedValue('default');

    const { loadPresets, currentPreset, saveCurrentPreset } = useApiPresets();
    await loadPresets();

    await saveCurrentPreset({
      url: 'https://example.com/v1',
      apiKey: '',
      model: 'model',
      streamEnabled: true,
      temperature: 1.2,
      topP: 0.9,
      frequencyPenalty: 0.3,
      presencePenalty: -0.2,
      stopSequences: ['\n\nUser:'],
      contextLength: 1000,
      maxOutputTokens: 4096,
    });

    expect(currentPreset.value?.temperature).toBe(1.2);
    expect(currentPreset.value?.contextLength).toBe(1000);
    expect(currentPreset.value?.topP).toBe(0.9);
    expect(currentPreset.value?.frequencyPenalty).toBe(0.3);
    expect(currentPreset.value?.presencePenalty).toBe(-0.2);
    expect(currentPreset.value?.stopSequences).toEqual(['\n\nUser:']);
  });
});
