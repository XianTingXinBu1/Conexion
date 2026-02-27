/**
 * 系统提示词构建模块 - 内容填充器
 *
 * 使用策略模式统一处理特殊条目的内容填充
 */

import { SPECIAL_ITEM_NAMES, DEFAULT_PROMPT_TEMPLATES, KNOWLEDGE_ENTRY_TEMPLATE } from '../utils/constants';
import { normalizeContent } from '../utils';
import type { ContentPlaceholder, ContentFillerContext } from '../types';
import type { PromptItem } from '@/types';

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
  'chat-history': () => '', // 由构建器单独处理
  'user-instruction': (context) => {
    const { userInstruction } = context;
    if (!userInstruction?.trim()) return '';
    return DEFAULT_PROMPT_TEMPLATES['user-instruction'].replace('{{user_instruction}}', userInstruction.trim());
  },
};

/**
 * 获取条目对应的占位符类型
 */
function getPlaceholderType(item: PromptItem): ContentPlaceholder | null {
  // 如果有自定义内容，不使用自动填充
  if (item.prompt?.trim()) return null;

  // 查找匹配的特殊条目名称
  const matchedKey = Object.keys(SPECIAL_ITEM_NAMES).find(
    key => item.name.includes(key) || key.includes(item.name)
  );

  return matchedKey ? SPECIAL_ITEM_NAMES[matchedKey]! : null;
}

/**
 * 填充条目内容
 */
export function fillItemContent(
  item: PromptItem,
  context: ContentFillerContext
): { content: string; placeholder: ContentPlaceholder | null } {
  const placeholder = getPlaceholderType(item);
  if (!placeholder) {
    return { content: normalizeContent(item.prompt), placeholder: null };
  }

  const content = FILLER_STRATEGIES[placeholder](context);
  return { content: normalizeContent(content), placeholder };
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
