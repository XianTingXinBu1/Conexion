import type { RegexRule } from '../types';

/**
 * 正则规则缓存
 * 用于缓存已解析的 RegExp 对象，避免重复解析
 */
const regexCache = new Map<string, RegExp>();

/**
 * 从缓存获取或创建 RegExp 对象
 */
function getOrCreateRegex(pattern: string, flags: string): RegExp | null {
  const cacheKey = `${pattern}|${flags}`;

  if (regexCache.has(cacheKey)) {
    return regexCache.get(cacheKey)!;
  }

  try {
    const regex = new RegExp(pattern, flags);
    regexCache.set(cacheKey, regex);
    return regex;
  } catch (error) {
    console.warn(`Invalid regex pattern: ${pattern}`, error);
    return null;
  }
}

/**
 * 清除正则缓存
 */
export function clearRegexCache(): void {
  regexCache.clear();
}

/**
 * 应用正则规则到文本
 *
 * @param text - 要处理的文本
 * @param type - 消息类型（'user' 或 'assistant'）
 * @param applyTo - 应用时机（'before-macro' 或 'after-macro'）
 * @param rules - 正则规则列表
 * @returns 处理后的文本
 */
export function applyRules(
  text: string,
  type: 'user' | 'assistant',
  applyTo: 'before-macro' | 'after-macro',
  rules: RegexRule[]
): string {
  let result = text;

  // 过滤符合条件的规则
  const applicableRules = rules.filter(rule => {
    // 规则必须启用
    if (!rule.enabled) return false;

    // 作用域匹配
    const scopeMatch = rule.scope === 'all' || rule.scope === type;

    // 应用时机匹配
    const applyToMatch = rule.applyTo === applyTo;

    return scopeMatch && applyToMatch;
  });

  // 按顺序应用规则
  for (const rule of applicableRules) {
    const regex = getOrCreateRegex(rule.pattern, rule.flags);

    if (!regex) {
      console.warn(`Skipping invalid rule: ${rule.name}`);
      continue;
    }

    try {
      result = result.replace(regex, rule.replacement);
    } catch (error) {
      console.warn(`Error applying rule: ${rule.name}`, error);
    }
  }

  return result;
}