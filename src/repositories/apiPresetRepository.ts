import type { Preset } from '@/types';
import { DEFAULT_API_PRESETS, STORAGE_KEYS } from '@/constants';
import { getSetting, setSetting } from '@/repositories/settingsRepository';

const API_PRESETS_ENDPOINT = '/api/api-presets';

async function readApiJson<T>(response: Response): Promise<T> {
  if (response.ok) {
    return await response.json() as T;
  }

  let message = `请求失败 (${response.status})`;
  try {
    const data = await response.json() as { error?: { message?: string }; message?: string };
    message = data.error?.message || data.message || message;
  } catch {
    // 保留默认错误信息
  }

  throw new Error(message);
}

async function requestJson<T>(options: RequestInit = {}): Promise<T> {
  const response = await fetch(API_PRESETS_ENDPOINT, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  return readApiJson<T>(response);
}

export async function loadApiPresets(): Promise<Preset[]> {
  const presets = await requestJson<Preset[]>();
  return Array.isArray(presets) ? presets : [];
}

export async function loadApiPresetsWithDefaults(): Promise<Preset[]> {
  const presets = await loadApiPresets();
  return presets.length > 0 ? presets : [...DEFAULT_API_PRESETS].map(preset => ({ ...preset }));
}

export async function saveApiPresets(presets: Preset[]): Promise<void> {
  await requestJson<Preset[]>({
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
