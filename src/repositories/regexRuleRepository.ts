import type { RegexRule } from '@/types';
import { DEFAULT_REGEX_SCRIPTS, STORAGE_KEYS } from '@/constants';
import { getStorage, setStorage } from '@/utils/storage';
import { clearRegexCache } from '@/utils/regexEngine';

export async function loadRegexRules(): Promise<RegexRule[]> {
  clearRegexCache();
  const stored = await getStorage<RegexRule[]>(STORAGE_KEYS.REGEX_SCRIPTS, [...DEFAULT_REGEX_SCRIPTS]);
  return Array.isArray(stored) ? stored : [...DEFAULT_REGEX_SCRIPTS];
}

export async function saveRegexRules(rules: RegexRule[]): Promise<void> {
  await setStorage(STORAGE_KEYS.REGEX_SCRIPTS, rules);
}
