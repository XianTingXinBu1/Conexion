/**
 * 系统提示词构建模块 - 工具函数
 */

import { countMessagesTokens, countTokens } from '@/utils/tokenCounter';
import type { ChatMessage } from '@/types';

/**
 * 估算文本的 token 数量
 *
 * 复用聊天侧同一个 gpt-tokenizer（cl100k）计数器，避免与上下文用量出现两套口径。
 * 与上游真实分词器可能有细微差异，但远优于旧版「字符数 × 0.25 折算」——
 * 后者是英文经验值，对中文会低估 3~4 倍。
 */
export function estimateTokens(text: string): number {
  return countTokens(text);
}

/**
 * 估算 messages 数组的总 token 数量（含每条消息的固定开销）
 */
export function estimateMessagesTokens(messages: ChatMessage[]): number {
  return countMessagesTokens(messages);
}

/**
 * 格式化内容（去除首尾空白，规范化换行）
 */
export function normalizeContent(content: string): string {
  if (!content) return '';
  return content.trim().replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/**
 * 检查内容是否为空（只包含空白字符）
 */
export function isContentEmpty(content: string): boolean {
  if (!content) return true;
  return !content.trim();
}

/**
 * 合并多个消息的内容
 */
export function mergeMessageContents(messages: ChatMessage[], separator: string = '\n\n'): string {
  return messages.map(msg => msg.content).filter(Boolean).join(separator);
}

/**
 * 验证角色类型
 */
export function isValidRoleType(role: string): role is 'system' | 'user' | 'assistant' {
  return ['system', 'user', 'assistant'].includes(role);
}