const SETTINGS_API_BASE = '/api/settings';

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

export async function getSetting<T>(key: string, defaultValue: T): Promise<T> {
  const response = await fetch(`${SETTINGS_API_BASE}/${encodeURIComponent(key)}`);
  const data = await readApiJson<{ value?: T }>(response);
  return data.value === undefined || data.value === null ? defaultValue : data.value;
}

export async function setSetting<T>(key: string, value: T): Promise<T> {
  const response = await fetch(`${SETTINGS_API_BASE}/${encodeURIComponent(key)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value }),
  });
  const data = await readApiJson<{ value: T }>(response);
  return data.value;
}

export async function getAllSettings(): Promise<Record<string, unknown>> {
  return await readApiJson<Record<string, unknown>>(await fetch(SETTINGS_API_BASE));
}

export async function replaceSettings(settings: Record<string, unknown>): Promise<Record<string, unknown>> {
  return await readApiJson<Record<string, unknown>>(await fetch(SETTINGS_API_BASE, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ settings }),
  }));
}

export async function clearBackendData(): Promise<void> {
  await readApiJson<{ ok: boolean }>(await fetch('/api/data', { method: 'DELETE' }));
}
