import type { RegexRule } from '@/types';
import { DEFAULT_REGEX_SCRIPTS } from '@/constants';
import { clearRegexCache } from '@/utils/regexEngine';

const REGEX_RULES_ENDPOINT = '/api/regex-rules';

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
  const response = await fetch(REGEX_RULES_ENDPOINT, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  return readApiJson<T>(response);
}

export async function loadRegexRules(): Promise<RegexRule[]> {
  clearRegexCache();
  const stored = await requestJson<RegexRule[]>();
  return Array.isArray(stored) && stored.length > 0 ? stored : [...DEFAULT_REGEX_SCRIPTS].map(rule => ({ ...rule }));
}

export async function saveRegexRules(rules: RegexRule[]): Promise<void> {
  await requestJson<RegexRule[]>({
    method: 'PUT',
    body: JSON.stringify({ rules }),
  });
}
