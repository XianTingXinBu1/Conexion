/**
 * 系统提示词构建模块 - 核心构建器
 *
 * 负责根据提示词预设和相关数据构建完整的 messages 数组
 */

import { DEFAULT_MERGE_MODE } from '../utils/constants';
import { estimateMessagesTokens, isContentEmpty } from '../utils';
import {
  fillItemContent,
  isChatHistoryItem,
  isCompressionSummaryItem,
  isUserInstructionItem,
} from './content-filler';
import { mergeMessages } from './merger';
import type { ChatMessage } from '@/types';
import type { SystemPromptConfig, SystemPromptResult, BuildMetadata } from '../types';

/**
 * 处理聊天历史条目
 */
function processChatHistoryItem(chatHistory: SystemPromptConfig['chatHistory']): ChatMessage[] {
  if (!chatHistory?.length) return [];

  return chatHistory.map(msg => ({
    role: msg.type === 'assistant' ? 'assistant' : 'user',
    content: msg.content,
  }));
}

/**
 * 处理用户指令条目
 */
function processUserInstructionItem(userInstruction: string): ChatMessage | null {
  if (!userInstruction?.trim()) return null;
  return { role: 'user', content: userInstruction.trim() };
}

function processCompressionSummaryItem(compressionSummary: string): ChatMessage | null {
  if (!compressionSummary?.trim()) return null;
  return { role: 'system', content: compressionSummary.trim() };
}

/**
 * 构建系统提示词
 */
export function buildSystemPrompt(config: SystemPromptConfig): SystemPromptResult {
  const {
    preset,
    aiCharacter,
    userCharacter,
    knowledgeBases,
    chatHistory = [],
    userInstruction = '',
    compressionSummary = '',
    mergeMode = DEFAULT_MERGE_MODE,
    filterEmptyPrompts = true,
  } = config;

  const context = {
    aiCharacter,
    userCharacter,
    knowledgeBases,
    chatHistory,
    userInstruction,
    compressionSummary,
  };

  const messages: ChatMessage[] = [];
  const usedItemIds: string[] = [];
  const skippedItemIds: string[] = [];
  const filledPlaceholders: BuildMetadata['filledPlaceholders'] = {};
  let chatHistoryCount = 0;
  let userInstructionIncluded = false;
  let compressionSummaryIncluded = false;

  // 按插入位置排序
  const sortedItems = [...preset.items].sort((a, b) =>
    (a.insertPosition ?? 999) - (b.insertPosition ?? 999)
  );
  const hasCompressionSummaryItem = sortedItems.some(item => item.enabled && isCompressionSummaryItem(item));

  // 处理每个条目
  for (const item of sortedItems) {
    // 跳过未启用的条目
    if (!item.enabled) {
      skippedItemIds.push(item.id);
      continue;
    }

    // 压缩摘要条目
    if (isCompressionSummaryItem(item)) {
      const compressionMessage = processCompressionSummaryItem(compressionSummary);
      filledPlaceholders[item.id] = {
        placeholder: 'compression-summary',
        success: Boolean(compressionMessage),
        contentLength: compressionMessage?.content.length ?? 0,
      };

      if (compressionMessage) {
        messages.push(compressionMessage);
        compressionSummaryIncluded = true;
        usedItemIds.push(item.id);
      } else {
        skippedItemIds.push(item.id);
      }
      continue;
    }

    // 聊天历史条目
    if (isChatHistoryItem(item)) {
      const historyMessages = processChatHistoryItem(chatHistory);
      chatHistoryCount = historyMessages.length;
      filledPlaceholders[item.id] = {
        placeholder: 'chat-history',
        success: historyMessages.length > 0,
        contentLength: historyMessages.reduce((total, message) => total + message.content.length, 0),
      };

      if (historyMessages.length > 0) {
        messages.push(...historyMessages);
        usedItemIds.push(item.id);
      } else {
        skippedItemIds.push(item.id);
      }
      continue;
    }

    // 用户指令条目
    if (isUserInstructionItem(item)) {
      const instructionMessage = processUserInstructionItem(userInstruction);
      filledPlaceholders[item.id] = {
        placeholder: 'user-instruction',
        success: Boolean(instructionMessage),
        contentLength: instructionMessage?.content.length ?? 0,
      };

      if (instructionMessage) {
        messages.push(instructionMessage);
        userInstructionIncluded = true;
        usedItemIds.push(item.id);
      } else {
        skippedItemIds.push(item.id);
      }
      continue;
    }

    // 普通条目
    const { content, placeholder } = fillItemContent(item, context);

    // 记录填充结果
    if (placeholder) {
      filledPlaceholders[item.id] = {
        placeholder,
        success: content.length > 0,
        contentLength: content.length,
      };
    }

    // 过滤空内容
    if (filterEmptyPrompts && isContentEmpty(content)) {
      skippedItemIds.push(item.id);
      continue;
    }

    messages.push({ role: item.roleType, content });
    usedItemIds.push(item.id);
  }

  // 兼容旧预设：如果还没有“压缩摘要”条目，则维持旧行为，默认前置注入
  if (!compressionSummaryIncluded && !hasCompressionSummaryItem) {
    const compressionMessage = processCompressionSummaryItem(compressionSummary);
    if (compressionMessage) {
      messages.unshift(compressionMessage);
    }
  }

  // 合并消息
  const mergeResult = mergeMessages(messages, mergeMode);

  // 构建元数据
  const metadata: BuildMetadata = {
    timestamp: Date.now(),
    presetId: preset.id,
    totalItems: sortedItems.length,
    enabledItems: sortedItems.filter(i => i.enabled).length,
    filledPlaceholders,
    userInstructionIncluded,
  };

  return {
    messages: mergeResult.messages,
    usedItemIds,
    skippedItemIds,
    chatHistoryCount,
    userInstructionIncluded,
    estimatedTokens: estimateMessagesTokens(mergeResult.messages),
    metadata,
  };
}
