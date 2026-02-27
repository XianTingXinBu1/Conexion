import type { RegexRule } from '../types';
import { DEFAULT_REGEX_SCRIPTS } from '../constants';
import { useLocalStorage } from './useLocalStorage';

const STORAGE_KEY = 'conexion_regex_scripts';

/**
 * 正则规则管理 Composable
 * 提供正则规则的加载、保存、添加、编辑、删除、启用/禁用等功能
 */
export function useRegexRules() {
  const { value: rules } = useLocalStorage<RegexRule[]>(
    STORAGE_KEY,
    [...DEFAULT_REGEX_SCRIPTS]
  );

  /**
   * 添加新规则
   */
  const addRule = (rule: Omit<RegexRule, 'id'>): RegexRule => {
    const newRule: RegexRule = {
      id: Date.now().toString(),
      ...rule,
    };
    rules.value.push(newRule);
    return newRule;
  };

  /**
   * 更新规则
   */
  const updateRule = (id: string, updates: Partial<RegexRule>): boolean => {
    const index = rules.value.findIndex(r => r.id === id);
    if (index !== -1) {
      rules.value[index] = { ...rules.value[index], ...updates } as RegexRule;
      return true;
    }
    return false;
  };

  /**
   * 删除规则
   */
  const deleteRule = (id: string): boolean => {
    const initialLength = rules.value.length;
    rules.value = rules.value.filter(r => r.id !== id);
    if (rules.value.length < initialLength) {
      return true;
    }
    return false;
  };

  /**
   * 切换启用状态
   */
  const toggleEnabled = (id: string): boolean => {
    const rule = rules.value.find(r => r.id === id);
    if (rule) {
      rule.enabled = !rule.enabled;
      return true;
    }
    return false;
  };

  /**
   * 获取规则
   */
  const getRule = (id: string): RegexRule | undefined => {
    return rules.value.find(r => r.id === id);
  };

  /**
   * 获取已启用的规则
   */
  const getEnabledRules = (): RegexRule[] => {
    return rules.value.filter(r => r.enabled);
  };

  /**
   * 根据作用域过滤规则
   */
  const getRulesByScope = (scope: 'user' | 'assistant' | 'all'): RegexRule[] => {
    return rules.value.filter(r => r.enabled && (r.scope === scope || r.scope === 'all'));
  };

  /**
   * 根据应用时机过滤规则
   */
  const getRulesByApplyTo = (applyTo: 'before-macro' | 'after-macro'): RegexRule[] => {
    return rules.value.filter(r => r.enabled && r.applyTo === applyTo);
  };

  return {
    rules,
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