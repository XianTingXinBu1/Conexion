/**
 * 系统提示词构建模块
 *
 * 提供动态提示词构建功能，将提示词预设中的条目转换为 OpenAI 格式的 messages 数组
 *
 * 核心功能：
 * - 根据提示词预设的条目顺序、启用状态、角色类型构建 messages
 * - 自动填充特殊条目内容（角色设定、用户设定、知识库、聊天历史）
 * - 支持合并相邻同类型消息
 * - Token 数量估算
 *
 * 使用示例：
 * ```typescript
 * import { buildSystemPrompt } from '@/modules/system-prompt';
 *
 * const result = buildSystemPrompt({
 *   preset: promptPreset,
 *   aiCharacter: character,
 *   userCharacter: user,
 *   knowledgeBases: knowledgeBases,
 *   chatHistory: messages,
 *   mergeMode: 'adjacent',
 * });
 *
 * console.log(result.messages); // OpenAI 格式的 messages 数组
 * console.log(result.estimatedTokens); // 估算的 token 数量
 * ```
 */

// 类型定义
export type {
  SystemPromptConfig,
  SystemPromptResult,
  ContentPlaceholder,
  MergeMode,
  BuildMetadata,
  ContentFillerContext,
  MergeResult,
} from './types';

// 核心功能
export {
  buildSystemPrompt,
  mergeMessages,
} from './core';

// 工具函数
export {
  estimateTokens,
  estimateMessagesTokens,
  normalizeContent,
  isContentEmpty,
  isValidRoleType,
} from './utils';

// 常量
export {
  SPECIAL_ITEM_NAMES,
  DEFAULT_MERGE_MODE,
  DEFAULT_PROMPT_TEMPLATES,
  KNOWLEDGE_ENTRY_TEMPLATE,
  MESSAGE_SEPARATOR,
  TOKEN_ESTIMATION_RATIO,
  MAX_INSERT_POSITION,
} from './utils/constants';