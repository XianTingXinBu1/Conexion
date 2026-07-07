import type { PromptPreset } from '@/types';
import { DEFAULT_PROMPT_PRESETS, STORAGE_KEYS } from '@/constants';
import { getStorage, setStorage } from '@/utils/storage';

export function cloneDefaultPromptPresets(): PromptPreset[] {
  return [...DEFAULT_PROMPT_PRESETS].map(preset => ({
    ...preset,
    items: [...preset.items],
  }));
}

export async function loadPromptPresets(): Promise<PromptPreset[]> {
  const stored = await getStorage<PromptPreset[]>(STORAGE_KEYS.PROMPT_PRESETS, cloneDefaultPromptPresets());
  return Array.isArray(stored) && stored.length > 0 ? stored : cloneDefaultPromptPresets();
}

export async function savePromptPresets(presets: PromptPreset[]): Promise<void> {
  await setStorage(STORAGE_KEYS.PROMPT_PRESETS, presets);
}

export async function loadSelectedPromptPresetId(): Promise<string> {
  return await getStorage<string>(STORAGE_KEYS.SELECTED_PROMPT_PRESET, '');
}

export async function saveSelectedPromptPresetId(id: string): Promise<void> {
  await setStorage(STORAGE_KEYS.SELECTED_PROMPT_PRESET, id);
}
