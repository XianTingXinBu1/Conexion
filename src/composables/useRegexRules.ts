import { onMounted, ref } from 'vue';
import type { RegexRule } from '@/types';
import { DEFAULT_REGEX_SCRIPTS } from '../constants';
import { validateRegex } from '@/utils/regexEngine';
import { loadRegexRules as loadStoredRules, saveRegexRules as saveStoredRules } from '@/repositories/regexRuleRepository';

export function useRegexRules() {
  const rules = ref<RegexRule[]>(DEFAULT_REGEX_SCRIPTS.map(rule => ({ ...rule })));
  const isSaving = ref(false);
  const isLoading = ref(true);
  const error = ref('');

  const loadRules = async () => {
    isLoading.value = true;
    try {
      rules.value = await loadStoredRules();
      error.value = '';
    } catch (err) {
      error.value = err instanceof Error ? err.message : '加载规则失败';
    } finally {
      isLoading.value = false;
    }
  };

  const commit = async (next: RegexRule[]) => {
    if (isSaving.value || isLoading.value) throw new Error('正在加载或保存规则，请稍后重试');
    isSaving.value = true;
    error.value = '';
    try {
      await saveStoredRules(next);
      rules.value = next;
    } catch (err) {
      error.value = err instanceof Error ? err.message : '保存规则失败';
      throw err;
    } finally {
      isSaving.value = false;
    }
  };

  const assertValid = (rule: RegexRule | Omit<RegexRule, 'id'>) => {
    const message = validateRegex(rule.pattern, rule.flags);
    if (message) throw new Error(message);
  };

  const addRule = async (rule: Omit<RegexRule, 'id'>): Promise<RegexRule> => {
    assertValid(rule);
    const next = { ...rule, id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}` };
    await commit([...rules.value, next]);
    return next;
  };

  const updateRule = async (id: string, updates: Partial<RegexRule>): Promise<boolean> => {
    const original = rules.value.find(rule => rule.id === id);
    if (!original) return false;
    const next = { ...original, ...updates };
    assertValid(next);
    await commit(rules.value.map(rule => rule.id === id ? next : rule));
    return true;
  };

  const deleteRule = async (id: string): Promise<boolean> => {
    if (!rules.value.some(rule => rule.id === id)) return false;
    await commit(rules.value.filter(rule => rule.id !== id));
    return true;
  };

  const toggleEnabled = async (id: string): Promise<boolean> => {
    const rule = rules.value.find(rule => rule.id === id);
    return rule ? updateRule(id, { enabled: !rule.enabled }) : false;
  };

  onMounted(() => { void loadRules(); });

  return {
    rules, isSaving, isLoading, error, loadRules,
    saveRules: () => commit(rules.value.map(rule => ({ ...rule }))),
    addRule, updateRule, deleteRule, toggleEnabled,
    getRule: (id: string) => rules.value.find(rule => rule.id === id),
    getEnabledRules: () => rules.value.filter(rule => rule.enabled),
    getRulesByScope: (scope: 'user' | 'assistant' | 'all') => rules.value.filter(rule => rule.enabled && (rule.scope === scope || rule.scope === 'all')),
    getRulesByApplyTo: (applyTo: 'before-macro' | 'after-macro') => rules.value.filter(rule => rule.enabled && rule.applyTo === applyTo),
  };
}
