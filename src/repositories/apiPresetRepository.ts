import type { Preset } from '@/types';
import { DEFAULT_API_PRESETS, STORAGE_KEYS } from '@/constants';
import { getStorage, setStorage } from '@/utils/storage';

export async function loadApiPresets(): Promise<Preset[]> {
  const presets = await getStorage<Preset[]>(STORAGE_KEYS.API_PRESETS, []);
  return Array.isArray(presets) ? presets : [];
}

export async function loadApiPresetsWithDefaults(): Promise<Preset[]> {
  const presets = await getStorage<Preset[]>(STORAGE_KEYS.API_PRESETS, [...DEFAULT_API_PRESETS]);
  return Array.isArray(presets) && presets.length > 0 ? presets : [...DEFAULT_API_PRESETS];
}

export async function saveApiPresets(presets: Preset[]): Promise<void> {
  await setStorage(STORAGE_KEYS.API_PRESETS, presets);
}

export async function loadSelectedApiPresetId(): Promise<string> {
  return await getStorage<string>(STORAGE_KEYS.SELECTED_PRESET, '');
}

export async function saveSelectedApiPresetId(id: string): Promise<void> {
  await setStorage(STORAGE_KEYS.SELECTED_PRESET, id);
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
