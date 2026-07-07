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
  const response = await fetch(PROMPT_PRESETS_ENDPOINT, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  return readApiJson<T>(response);
}

export async function loadPromptPresets(): Promise<PromptPreset[]> {
  const stored = await requestJson<PromptPreset[]>();
  return Array.isArray(stored) && stored.length > 0 ? stored : cloneDefaultPromptPresets();
}

export async function savePromptPresets(presets: PromptPreset[]): Promise<void> {
  await requestJson<PromptPreset[]>({
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
