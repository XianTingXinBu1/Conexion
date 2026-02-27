/**
 * 系统提示词构建模块 - 核心构建器
 *
 * 负责根据提示词预设和相关数据构建完整的 messages 数组
 */

import { DEFAULT_MERGE_MODE } from '../utils/constants';
import { estimateMessagesTokens, isContentEmpty } from '../utils';
import { fillItemContent, isChatHistoryItem, isUserInstructionItem } from './content-filler';
import { mergeMessages } from './merger';
import type { SystemPromptConfig, SystemPromptResult, BuildMetadata } from '../types';
import type { ChatMessage } from '@/types';

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
    mergeMode = DEFAULT_MERGE_MODE,
    filterEmptyPrompts = true,
  } = config;

  const context = {
    aiCharacter,
    userCharacter,
    knowledgeBases,
    chatHistory,
    userInstruction,
  };

  const messages: ChatMessage[] = [];
  const usedItemIds: string[] = [];
  const skippedItemIds: string[] = [];
  const filledPlaceholders: BuildMetadata['filledPlaceholders'] = {};
  let chatHistoryCount = 0;
  let userInstructionIncluded = false;

  // 按插入位置排序
  const sortedItems = [...preset.items].sort((a, b) => 
    (a.insertPosition ?? 999) - (b.insertPosition ?? 999)
  );

  // 处理每个条目
  for (const item of sortedItems) {
    // 跳过未启用的条目
    if (!item.enabled) {
      skippedItemIds.push(item.id);
      continue;
    }

    // 聊天历史条目
    if (isChatHistoryItem(item)) {
      const historyMessages = processChatHistoryItem(chatHistory);
      messages.push(...historyMessages);
      chatHistoryCount = historyMessages.length;
      usedItemIds.push(item.id);
      continue;
    }

    // 用户指令条目
    if (isUserInstructionItem(item)) {
      const instructionMessage = processUserInstructionItem(userInstruction);
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