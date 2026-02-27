/**
 * 系统提示词构建模块 - 工具函数
 */

import { TOKEN_ESTIMATION_RATIO } from './constants';
import type { ChatMessage } from '@/types';

/**
 * 估算文本的 token 数量
 * 使用粗略估算：1 token ≈ 4 字符
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length * TOKEN_ESTIMATION_RATIO);
}

/**
 * 估算 messages 数组的总 token 数量
 */
export function estimateMessagesTokens(messages: ChatMessage[]): number {
  return messages.reduce((total, msg) => {
    return total + estimateTokens(msg.content);
  }, 0);
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