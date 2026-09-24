/**
 * 系统提示词构建模块 - 内容填充器
 *
 * 使用策略模式统一处理特殊条目的内容填充
 */

import { SPECIAL_ITEM_NAMES, DEFAULT_PROMPT_TEMPLATES, KNOWLEDGE_ENTRY_TEMPLATE } from '../utils/constants';
import { normalizeContent } from '../utils';
import { applyMacros, buildMacroValues } from './macro';
import type { PromptItem } from '@/types';
import type { ContentPlaceholder, ContentFillerContext } from '../types';

/**
 * 内容填充器策略接口
 */
type ContentFillerStrategy = (context: ContentFillerContext) => string;

/**
 * 特殊条目处理器映射
 */
const FILLER_STRATEGIES: Record<ContentPlaceholder, ContentFillerStrategy> = {
  character: (context) => {
    const { aiCharacter } = context;
    if (!aiCharacter) return '';
    return DEFAULT_PROMPT_TEMPLATES.character
      .replace('{{name}}', aiCharacter.name)
      .replace('{{description}}', aiCharacter.description)
      .replace('{{personality}}', aiCharacter.personality);
  },
  user: (context) => {
    const { userCharacter } = context;
    if (!userCharacter) return '';
    return DEFAULT_PROMPT_TEMPLATES.user
      .replace('{{name}}', userCharacter.name)
      .replace('{{description}}', userCharacter.description);
  },
  knowledge: (context) => {
    const { knowledgeBases } = context;
    if (!knowledgeBases?.length) return '';

    const entries: string[] = [];
    for (const kb of knowledgeBases) {
      if (!kb.globallyEnabled) continue;
      for (const entry of kb.entries) {
        if (entry.enabled) {
          entries.push(
            KNOWLEDGE_ENTRY_TEMPLATE
              .replace('{{name}}', entry.name)
              .replace('{{content}}', entry.content)
          );
        }
      }
    }

    if (!entries.length) return '';
    return DEFAULT_PROMPT_TEMPLATES.knowledge.replace('{{knowledge_entries}}', entries.join('\n\n'));
  },
  'compression-summary': (context) => {
    const { compressionSummary } = context;
    if (!compressionSummary?.trim()) return '';
    return DEFAULT_PROMPT_TEMPLATES['compression-summary'].replace('{{compression_summary}}', compressionSummary.trim());
  },
  'chat-history': () => '', // 由构建器单独处理
  'user-instruction': () => '', // 由构建器单独处理
};

/**
 * 获取条目对应的占位符类型
 */
function getPlaceholderType(item: PromptItem): ContentPlaceholder | null {
  // 如果有自定义内容，不使用自动填充
  if (item.prompt?.trim()) return null;

  const exactIdMatch = item.id ? SPECIAL_ITEM_NAMES[item.id] : undefined;
  if (exactIdMatch) {
    return exactIdMatch;
  }

  const exactNameMatch = SPECIAL_ITEM_NAMES[item.name];
  if (exactNameMatch) {
    return exactNameMatch;
  }

  // 查找匹配的特殊条目名称
  const matchedKey = Object.keys(SPECIAL_ITEM_NAMES).find(
    key => item.name.includes(key) || key.includes(item.name)
  );

  return matchedKey ? SPECIAL_ITEM_NAMES[matchedKey]! : null;
}

/**
 * 填充条目内容
 *
 * 规则：
 * - 特殊条目（角色设定 / 用户设定 / 知识库 / 压缩摘要）走内置模板插槽；
 * - 自定义 prompt 内容优先，但会执行宏（{{...}}）替换；
 * - 特殊条目本身没有自定义内容时，也会对模板结果做宏替换，保证一致性。
 */
export function fillItemContent(
  item: PromptItem,
  context: ContentFillerContext
): { content: string; placeholder: ContentPlaceholder | null } {
  const macroValues = buildMacroValues(context);

  // 自定义内容优先：无论是普通条目还是特殊条目，只要写了 prompt，
  // 就以自定义内容为准，并执行宏（{{...}}）替换。
  if (item.prompt?.trim()) {
    return {
      content: normalizeContent(applyMacros(item.prompt, macroValues)),
      placeholder: null,
    };
  }

  const placeholder = getPlaceholderType(item);
  if (!placeholder) {
    return { content: '', placeholder: null };
  }

  const content = FILLER_STRATEGIES[placeholder](context);
  return { content: normalizeContent(applyMacros(content, macroValues)), placeholder };
}

/**
 * 检查条目是否为聊天历史条目
 */
export function isChatHistoryItem(item: PromptItem): boolean {
  const placeholder = getPlaceholderType(item);
  return placeholder === 'chat-history';
}

/**
 * 检查条目是否为用户指令条目
 */
export function isUserInstructionItem(item: PromptItem): boolean {
  const placeholder = getPlaceholderType(item);
  return placeholder === 'user-instruction';
}

export function isCompressionSummaryItem(item: PromptItem): boolean {
  const placeholder = getPlaceholderType(item);
  return placeholder === 'compression-summary';
}
