/**
 * 系统提示词构建模块 - 内容填充器
 *
 * 使用策略模式统一处理特殊条目的内容填充。
 *
 * 渲染分两个命名空间，顺序固定：
 * 1. `{{宏}}`：只展开模板（作者文本）里的变量；
 * 2. `{{#槽位}}`：单次注入运行时数据，注入内容不再被扫描。
 *
 * 这样既保证作者写的 `{{char}}` 生效，又保证角色字段 / 知识库正文里的
 * `{{...}}` 不会被二次展开，同时避免 `$&` 之类替换转义问题。
 */

import { SPECIAL_ITEM_NAMES, DEFAULT_PROMPT_TEMPLATES, KNOWLEDGE_ENTRY_TEMPLATE } from '../utils/constants';
import { normalizeContent } from '../utils';
import { applyMacros, buildMacroValues } from './macro';
import type { PromptItem } from '@/types';
import type { ContentPlaceholder, ContentFillerContext, MacroVariableName } from '../types';

/**
 * 模板 + 数据槽位
 */
interface SlotTemplate {
  template: string;
  slots: Record<string, string>;
}

/**
 * 内容填充器策略接口：只负责给出模板与槽位数据，不自己做字符串拼接
 */
type ContentFillerStrategy = (context: ContentFillerContext) => SlotTemplate | null;

/**
 * 数据槽位语法：`{{#name}}`
 *
 * `#` 刻意落在宏正则 `[a-zA-Z_]` 之外，宏展开天然跳过槽位，
 * 槽位也不会被误认为未识别宏而保留下来。
 */
const SLOT_PATTERN = /\{\{#\s*([a-zA-Z_]+)\s*\}\}/g;

/**
 * 单次注入槽位数据。
 *
 * 用回调形式替换：注入内容不会被二次扫描，也不会被当成 `$&` / `$1` 之类的替换模式。
 */
function fillSlots(template: string, slots: Record<string, string>): string {
  return template.replace(SLOT_PATTERN, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(slots, key) ? (slots[key] ?? '') : match
  );
}

/**
 * 渲染模板：先展开作者宏，再注入数据槽位
 */
function renderTemplate(
  { template, slots }: SlotTemplate,
  macroValues: Record<MacroVariableName, string>
): string {
  return fillSlots(applyMacros(template, macroValues), slots);
}

/**
 * 特殊条目处理器映射
 */
const FILLER_STRATEGIES: Record<ContentPlaceholder, ContentFillerStrategy> = {
  character: ({ aiCharacter }) => {
    if (!aiCharacter) return null;
    return {
      template: DEFAULT_PROMPT_TEMPLATES.character,
      slots: {
        name: aiCharacter.name,
        description: aiCharacter.description,
        personality: aiCharacter.personality,
      },
    };
  },
  scenario: ({ aiCharacter }) => {
    if (!aiCharacter?.scenario?.trim()) return null;
    return {
      template: DEFAULT_PROMPT_TEMPLATES.scenario,
      slots: { scenario: aiCharacter.scenario },
    };
  },
  'example-dialogue': ({ aiCharacter }) => {
    if (!aiCharacter?.exampleDialogue?.trim()) return null;
    return {
      template: DEFAULT_PROMPT_TEMPLATES['example-dialogue'],
      slots: { example_dialogue: aiCharacter.exampleDialogue },
    };
  },
  user: ({ userCharacter }) => {
    if (!userCharacter) return null;
    return {
      template: DEFAULT_PROMPT_TEMPLATES.user,
      slots: {
        name: userCharacter.name,
        description: userCharacter.description,
      },
    };
  },
  knowledge: ({ knowledgeBases, aiCharacter }) => {
    if (!knowledgeBases?.length) return null;
    const contextCharacterKnowledgeBaseId = aiCharacter?.knowledgeBaseId;

    const seenKnowledgeBaseIds = new Set<string>();
    const activeEntries = knowledgeBases.flatMap(kb => {
      if (!kb.globallyEnabled && kb.id !== contextCharacterKnowledgeBaseId) return [];
      if (seenKnowledgeBaseIds.has(kb.id)) return [];
      seenKnowledgeBaseIds.add(kb.id);
      return kb.entries.filter(entry => entry.enabled);
    });
    // 跨知识库统一排序；同优先级保留原顺序，旧数据缺省为 50。
    activeEntries.sort((a, b) => (a.priority ?? 50) - (b.priority ?? 50));
    const entries = activeEntries.map(entry =>
      // 知识库正文属于注入数据：按原样写入，不参与宏展开。
      fillSlots(KNOWLEDGE_ENTRY_TEMPLATE, {
        name: entry.name,
        content: entry.content,
      })
    );

    if (!entries.length) return null;
    return {
      template: DEFAULT_PROMPT_TEMPLATES.knowledge,
      slots: { knowledge_entries: entries.join('\n\n') },
    };
  },
  'compression-summary': ({ compressionSummary }) => {
    if (!compressionSummary?.trim()) return null;
    return {
      template: DEFAULT_PROMPT_TEMPLATES['compression-summary'],
      slots: { compression_summary: compressionSummary.trim() },
    };
  },
  'chat-history': () => null, // 由构建器单独处理
  'user-instruction': () => null, // 由构建器单独处理
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
 * - 自定义 prompt 内容优先，作为作者文本执行宏（{{...}}）替换；
 * - 特殊条目没有自定义内容时，走内置模板：先展开模板宏，再注入运行时数据；
 * - 注入的数据（角色字段 / 知识库正文 / 压缩摘要）不参与宏展开。
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

  const slotTemplate = FILLER_STRATEGIES[placeholder](context);
  if (!slotTemplate) {
    return { content: '', placeholder };
  }

  return {
    content: normalizeContent(renderTemplate(slotTemplate, macroValues)),
    placeholder,
  };
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
