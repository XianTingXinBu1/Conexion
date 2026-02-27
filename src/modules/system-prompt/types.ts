/**
 * 系统提示词构建模块 - 类型定义
 */

import type { PromptPreset, UserCharacter, AICharacter, KnowledgeBase, Message, ChatMessage } from '@/types';

/**
 * 内容占位符类型
 */
export type ContentPlaceholder =
  | 'character'           // 角色设定
  | 'user'                // 用户设定
  | 'knowledge'           // 知识库
  | 'chat-history'        // 聊天历史
  | 'user-instruction';   // 用户指令（当前输入）

/**
 * 合并模式
 */
export type MergeMode = 'none' | 'adjacent' | 'all';

/**
 * 系统提示词构建配置
 */
export interface SystemPromptConfig {
  /** 提示词预设 */
  preset: PromptPreset;
  /** AI 角色（可选） */
  aiCharacter?: AICharacter;
  /** 用户角色（可选） */
  userCharacter?: UserCharacter;
  /** 知识库列表（可选） */
  knowledgeBases?: KnowledgeBase[];
  /** 聊天历史（可选） */
  chatHistory?: Message[];
  /** 当前用户输入的指令（可选） */
  userInstruction?: string;
  /** 合并模式（默认: adjacent） */
  mergeMode?: MergeMode;
  /** 是否在构建时过滤掉空的 prompt（默认: true） */
  filterEmptyPrompts?: boolean;
}

/**
 * 系统提示词构建结果
 */
export interface SystemPromptResult {
  /** 构建后的 messages 数组 */
  messages: ChatMessage[];
  /** 使用的条目 ID 列表 */
  usedItemIds: string[];
  /** 被跳过的条目 ID 列表（未启用或内容为空） */
  skippedItemIds: string[];
  /** 聊天历史消息数量 */
  chatHistoryCount: number;
  /** 是否包含用户指令 */
  userInstructionIncluded: boolean;
  /** 总 token 数估算 */
  estimatedTokens: number;
  /** 构建元数据 */
  metadata: BuildMetadata;
}

/**
 * 构建元数据
 */
export interface BuildMetadata {
  /** 构建时间戳 */
  timestamp: number;
  /** 提示词预设 ID */
  presetId: string;
  /** 总条目数 */
  totalItems: number;
  /** 启用条目数 */
  enabledItems: number;
  /** 特殊条目填充结果 */
  filledPlaceholders: Record<string, {
    placeholder: ContentPlaceholder;
    success: boolean;
    contentLength: number;
  }>;
  /** 是否包含用户指令 */
  userInstructionIncluded: boolean;
}

/**
 * 内容填充器上下文
 */
export interface ContentFillerContext {
  aiCharacter?: AICharacter;
  userCharacter?: UserCharacter;
  knowledgeBases?: KnowledgeBase[];
  chatHistory?: Message[];
  userInstruction?: string;
}

/**
 * 消息合并结果
 */
export interface MergeResult {
  /** 合并后的 messages */
  messages: ChatMessage[];
  /** 合并次数 */
  mergeCount: number;
  /** 节省的消息数量 */
  savedMessages: number;
}