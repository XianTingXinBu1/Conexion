import { requestJson } from '@/api/http';

const SETTINGS_API_BASE = '/api/settings';

export async function getSetting<T>(key: string, defaultValue: T): Promise<T> {
  const data = await requestJson<{ value?: T }>(`${SETTINGS_API_BASE}/${encodeURIComponent(key)}`);
  return data.value === undefined || data.value === null ? defaultValue : data.value;
}

export async function setSetting<T>(key: string, value: T): Promise<T> {
  const data = await requestJson<{ value: T }>(`${SETTINGS_API_BASE}/${encodeURIComponent(key)}`, {
    method: 'PUT',
    body: JSON.stringify({ value }),
  });
  return data.value;
}

export async function getAllSettings(): Promise<Record<string, unknown>> {
  return await requestJson<Record<string, unknown>>(SETTINGS_API_BASE);
}

export async function replaceSettings(settings: Record<string, unknown>): Promise<Record<string, unknown>> {
  return await requestJson<Record<string, unknown>>(SETTINGS_API_BASE, {
    method: 'PUT',
    body: JSON.stringify({ settings }),
  });
}

export async function clearBackendData(): Promise<void> {
  await requestJson<{ ok: boolean }>('/api/data', { method: 'DELETE' });
}
