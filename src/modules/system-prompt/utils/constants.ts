/**
 * 系统提示词构建模块 - 常量定义
 */

import type { ContentPlaceholder, MergeMode } from '../types';

/**
 * 特殊条目名称到占位符类型的映射
 */
export const SPECIAL_ITEM_NAMES: Record<string, ContentPlaceholder> = {
  // 角色设定
  '角色设定': 'character',
  'character-setting': 'character',

  // 场景
  '场景': 'scenario',
  '场景设定': 'scenario',
  'scenario': 'scenario',

  // 对话示例
  '对话示例': 'example-dialogue',
  '对话例子': 'example-dialogue',
  'example-dialogue': 'example-dialogue',
  'mes-example': 'example-dialogue',

  // 用户设定
  '用户设定': 'user',
  'user-setting': 'user',

  // 知识库
  '知识库': 'knowledge',
  'knowledge-base': 'knowledge',

  // 压缩摘要
  '压缩摘要': 'compression-summary',
  'compression-summary': 'compression-summary',

  // 聊天历史
  '聊天历史': 'chat-history',
  'chat-history': 'chat-history',

  // 用户指令
  '用户指令': 'user-instruction',
  'user-instruction': 'user-instruction',
} as const;

/**
 * 提示词模板
 *
 * 槽位统一使用数据命名空间 `{{#name}}`，与宏命名空间 `{{name}}` 明确区分：
 * - `{{...}}`      作者文本里的宏，由 applyMacros 展开；
 * - `{{#...}}`     模板槽位，由 fillSlots 注入运行时数据，注入内容不再被扫描。
 *
 * 两个命名空间不能混用：宏正则只认 `[a-zA-Z_]`，`#` 让其天然跳过槽位。
 */
export const DEFAULT_PROMPT_TEMPLATES: Record<ContentPlaceholder, string> = {
  character: `你现在是{{#name}}，以下是你的人设：

【描述】
{{#description}}

【性格】
{{#personality}}`,

  scenario: `当前场景：
{{#scenario}}`,

  'example-dialogue': `以下是对话示例，仅供参考语气与风格，不要照搬内容：

{{#example_dialogue}}`,

  user: `用户的身份信息：

【用户名】
{{#name}}

【用户描述】
{{#description}}`,

  knowledge: `以下是与本次对话相关的知识库内容：

{{#knowledge_entries}}`,

  'compression-summary': `以下是本会话已压缩的历史摘要，请将其视为此前对话上下文，并在后续回答中保持连续性：
{{#compression_summary}}`,

  'chat-history': `以下是对话历史记录：

{{#chat_history}}`,

  'user-instruction': `用户指令：

{{#user_instruction}}`,
} as const;

/**
 * 知识库条目模板
 */
export const KNOWLEDGE_ENTRY_TEMPLATE = `【{{#name}}】
{{#content}}`;

/**
 * 默认合并模式
 */
export const DEFAULT_MERGE_MODE: MergeMode = 'adjacent';

/**
 * 消息分隔符（用于合并消息）
 */
export const MESSAGE_SEPARATOR = '\n\n';

/**
 * 最大条目位置值（用于插入位置计算）
 */
export const MAX_INSERT_POSITION = 10000;