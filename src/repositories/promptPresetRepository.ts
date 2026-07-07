import { requestJson } from '@/api/http';
import type { PromptPreset } from '@/types';
import { DEFAULT_PROMPT_PRESETS, STORAGE_KEYS } from '@/constants';
import { getSetting, setSetting } from '@/repositories/settingsRepository';

const PROMPT_PRESETS_ENDPOINT = '/api/prompt-presets';

export function cloneDefaultPromptPresets(): PromptPreset[] {
  return [...DEFAULT_PROMPT_PRESETS].map(preset => ({
    ...preset,
    items: [...preset.items].map(item => ({ ...item })),
  }));
}

function requestPromptPresets<T>(options: RequestInit = {}): Promise<T> {
  return requestJson<T>(PROMPT_PRESETS_ENDPOINT, options);
}

export async function loadPromptPresets(): Promise<PromptPreset[]> {
  const stored = await requestPromptPresets<PromptPreset[]>();
  return Array.isArray(stored) && stored.length > 0 ? stored : cloneDefaultPromptPresets();
}

export async function savePromptPresets(presets: PromptPreset[]): Promise<void> {
  await requestPromptPresets<PromptPreset[]>({
    method: 'PUT',
    body: JSON.stringify({ presets }),
  });
}

export async function loadSelectedPromptPresetId(): Promise<string> {
  return await getSetting<string>(STORAGE_KEYS.SELECTED_PROMPT_PRESET, '');
}

export async function saveSelectedPromptPresetId(id: string): Promise<void> {
  await setSetting(STORAGE_KEYS.SELECTED_PROMPT_PRESET, id);
}
