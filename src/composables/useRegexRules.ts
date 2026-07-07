import { onMounted, ref } from 'vue';
import type { RegexRule } from '../types';
import { DEFAULT_REGEX_SCRIPTS } from '../constants';
import {
  loadRegexRules as loadRegexRulesFromRepository,
  saveRegexRules as saveRegexRulesToRepository,
} from '@/repositories/regexRuleRepository';

export function useRegexRules() {
  const rules = ref<RegexRule[]>([...DEFAULT_REGEX_SCRIPTS].map(rule => ({ ...rule })));

  const loadRules = async () => {
    rules.value = await loadRegexRulesFromRepository();
  };

  const saveRules = async () => {
    await saveRegexRulesToRepository(rules.value);
  };

  const persistRules = () => {
    void saveRules();
  };

  const addRule = (rule: Omit<RegexRule, 'id'>): RegexRule => {
    const newRule: RegexRule = {
      id: Date.now().toString(),
      ...rule,
    };
    rules.value.push(newRule);
    persistRules();
    return newRule;
  };

  const updateRule = (id: string, updates: Partial<RegexRule>): boolean => {
    const index = rules.value.findIndex(r => r.id === id);
    if (index !== -1) {
      rules.value[index] = { ...rules.value[index], ...updates } as RegexRule;
      persistRules();
      return true;
    }
    return false;
  };

  const deleteRule = (id: string): boolean => {
    const initialLength = rules.value.length;
    rules.value = rules.value.filter(r => r.id !== id);
    if (rules.value.length < initialLength) {
      persistRules();
      return true;
    }
    return false;
  };

  const toggleEnabled = (id: string): boolean => {
    const rule = rules.value.find(r => r.id === id);
    if (rule) {
      rule.enabled = !rule.enabled;
      persistRules();
      return true;
    }
    return false;
  };

  const getRule = (id: string): RegexRule | undefined => {
    return rules.value.find(r => r.id === id);
  };

  const getEnabledRules = (): RegexRule[] => {
    return rules.value.filter(r => r.enabled);
  };

  const getRulesByScope = (scope: 'user' | 'assistant' | 'all'): RegexRule[] => {
    return rules.value.filter(r => r.enabled && (r.scope === scope || r.scope === 'all'));
  };

  const getRulesByApplyTo = (applyTo: 'before-macro' | 'after-macro'): RegexRule[] => {
    return rules.value.filter(r => r.enabled && r.applyTo === applyTo);
  };

  onMounted(() => {
    void loadRules();
  });

  return {
    rules,
    loadRules,
    saveRules,
    addRule,
    updateRule,
    deleteRule,
    toggleEnabled,
    getRule,
    getEnabledRules,
    getRulesByScope,
    getRulesByApplyTo,
  };
}
