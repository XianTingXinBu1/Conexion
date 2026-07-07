import { requestJson } from '@/api/http';
import type { RegexRule } from '@/types';
import { DEFAULT_REGEX_SCRIPTS } from '@/constants';
import { clearRegexCache } from '@/utils/regexEngine';

const REGEX_RULES_ENDPOINT = '/api/regex-rules';

function requestRegexRules<T>(options: RequestInit = {}): Promise<T> {
  return requestJson<T>(REGEX_RULES_ENDPOINT, options);
}

export async function loadRegexRules(): Promise<RegexRule[]> {
  clearRegexCache();
  const stored = await requestRegexRules<RegexRule[]>();
  return Array.isArray(stored) && stored.length > 0 ? stored : [...DEFAULT_REGEX_SCRIPTS].map(rule => ({ ...rule }));
}

export async function saveRegexRules(rules: RegexRule[]): Promise<void> {
  await requestRegexRules<RegexRule[]>({
    method: 'PUT',
    body: JSON.stringify({ rules }),
  });
}
