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

  // 用户设定
  '用户设定': 'user',
  'user-setting': 'user',

  // 知识库
  '知识库': 'knowledge',
  'knowledge-base': 'knowledge',

  // 聊天历史
  '聊天历史': 'chat-history',
  'chat-history': 'chat-history',

  // 用户指令
  '用户指令': 'user-instruction',
  'user-instruction': 'user-instruction',
} as const;

/**
 * 提示词模板
 */
export const DEFAULT_PROMPT_TEMPLATES: Record<ContentPlaceholder, string> = {
  character: `你现在是{{name}}，以下是你的人设：

【描述】
{{description}}

【性格】
{{personality}}`,

  user: `用户的身份信息：

【用户名】
{{name}}

【用户描述】
{{description}}`,

  knowledge: `以下是与本次对话相关的知识库内容：

{{knowledge_entries}}`,

  'chat-history': `以下是对话历史记录：

{{chat_history}}`,

  'user-instruction': `用户指令：

{{user_instruction}}`,
} as const;

/**
 * 知识库条目模板
 */
export const KNOWLEDGE_ENTRY_TEMPLATE = `【{{name}}】
{{content}}`;

/**
 * 默认合并模式
 */
export const DEFAULT_MERGE_MODE: MergeMode = 'adjacent';

/**
 * 消息分隔符（用于合并消息）
 */
export const MESSAGE_SEPARATOR = '\n\n';

/**
 * Token 估算系数（粗略估算：1 token ≈ 4 字符）
 */
export const TOKEN_ESTIMATION_RATIO = 0.25;

/**
 * 最大条目位置值（用于插入位置计算）
 */
export const MAX_INSERT_POSITION = 10000;