import { requestJson } from '@/api/http';
import type { Preset } from '@/types';
import { DEFAULT_API_PRESETS, STORAGE_KEYS } from '@/constants';
import { getSetting, setSetting } from '@/repositories/settingsRepository';

const API_PRESETS_ENDPOINT = '/api/api-presets';

function requestApiPresets<T>(options: RequestInit = {}): Promise<T> {
  return requestJson<T>(API_PRESETS_ENDPOINT, options);
}

export async function loadApiPresets(): Promise<Preset[]> {
  const presets = await requestApiPresets<Preset[]>();
  return Array.isArray(presets) ? presets : [];
}

export async function loadApiPresetsWithDefaults(): Promise<Preset[]> {
  const presets = await loadApiPresets();
  return presets.length > 0 ? presets : [...DEFAULT_API_PRESETS].map(preset => ({ ...preset }));
}

export async function saveApiPresets(presets: Preset[]): Promise<void> {
  await requestApiPresets<Preset[]>({
    method: 'PUT',
    body: JSON.stringify({ presets }),
  });
}

export async function loadSelectedApiPresetId(): Promise<string> {
  return await getSetting<string>(STORAGE_KEYS.SELECTED_PRESET, '');
}

export async function saveSelectedApiPresetId(id: string): Promise<void> {
  await setSetting(STORAGE_KEYS.SELECTED_PRESET, id);
}

export async function loadCurrentApiPreset(): Promise<Preset | null> {
  const presets = await loadApiPresets();

  if (presets.length === 0) {
    return null;
  }

  let selectedPresetId = await loadSelectedApiPresetId();

  if (!selectedPresetId) {
    selectedPresetId = presets[0]!.id;
    await saveSelectedApiPresetId(selectedPresetId);
  }

  const preset = presets.find(item => item.id === selectedPresetId);
  if (preset) {
    return preset;
  }

  const fallbackPreset = presets[0];
  if (!fallbackPreset) {
    return null;
  }

  await saveSelectedApiPresetId(fallbackPreset.id);
  return fallbackPreset;
}
