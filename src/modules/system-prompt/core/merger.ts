/**
 * 系统提示词构建模块 - 消息合并器
 *
 * 负责合并相邻同类型的消息
 */

import { MESSAGE_SEPARATOR } from '../utils/constants';
import type { MergeResult, MergeMode } from '../types';
import type { ChatMessage } from '@/types';

/**
 * 合并相邻同类型的消息
 */
export function mergeAdjacentMessages(messages: ChatMessage[]): MergeResult {
  if (messages.length === 0) {
    return { messages: [], mergeCount: 0, savedMessages: 0 };
  }

  const merged: ChatMessage[] = [];
  let mergeCount = 0;

  let currentRole = messages[0]!.role;
  let currentContents: string[] = [messages[0]!.content];

  for (let i = 1; i < messages.length; i++) {
    const msg = messages[i]!;

    if (msg.role === currentRole) {
      // 相同角色，合并内容
      currentContents.push(msg.content);
      mergeCount++;
    } else {
      // 不同角色，保存当前消息并开始新的
      merged.push({
        role: currentRole,
        content: currentContents.join(MESSAGE_SEPARATOR),
      });
      currentRole = msg.role;
      currentContents = [msg.content];
    }
  }

  // 保存最后一条消息
  merged.push({
    role: currentRole,
    content: currentContents.join(MESSAGE_SEPARATOR),
  });

  return {
    messages: merged,
    mergeCount,
    savedMessages: mergeCount,
  };
}

/**
 * 合并所有消息到一个 system 消息中（不推荐，仅用于特殊场景）
 */
export function mergeAllMessages(messages: ChatMessage[]): MergeResult {
  if (messages.length === 0) {
    return { messages: [], mergeCount: 0, savedMessages: 0 };
  }

  const allContent = messages.map(msg => msg.content).join(MESSAGE_SEPARATOR);

  return {
    messages: [
      {
        role: 'system',
        content: allContent,
      },
    ],
    mergeCount: messages.length - 1,
    savedMessages: messages.length - 1,
  };
}

/**
 * 根据合并模式合并消息
 */
export function mergeMessages(messages: ChatMessage[], mode: MergeMode = 'adjacent'): MergeResult {
  switch (mode) {
    case 'none':
      return { messages, mergeCount: 0, savedMessages: 0 };
    case 'adjacent':
      return mergeAdjacentMessages(messages);
    case 'all':
      return mergeAllMessages(messages);
    default:
      return { messages, mergeCount: 0, savedMessages: 0 };
  }
}