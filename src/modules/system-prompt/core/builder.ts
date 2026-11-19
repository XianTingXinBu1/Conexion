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
    now = new Date(),
  } = config;

  const context = {
    aiCharacter,
    userCharacter,
    knowledgeBases,
    chatHistory,
    userInstruction,
    compressionSummary,
    now,
  };

  const messages: ChatMessage[] = [];
  const usedItemIds: string[] = [];
  const skippedItemIds: string[] = [];
  const filledPlaceholders: BuildMetadata['filledPlaceholders'] = {};
  let chatHistoryCount = 0;
  let userInstructionIncluded = false;
  let compressionSummaryIncluded = false;

  /**
   * 已处理过的特殊条目类型。
   *
   * 预设里可能存在多个同类启用条目（用户复制/新增），无去重时会把同一份内容
   * 重复 push 进 messages，chatHistoryCount 也会被反复赋值、与实际消息数不一致。
   */
  const handledSpecialKinds = new Set<'compression-summary' | 'chat-history' | 'user-instruction'>();

  // 按插入位置排序
  const sortedItems = [...preset.items].sort((a, b) =>
    (a.insertPosition ?? 999) - (b.insertPosition ?? 999)
  );
  // 这里刻意不看 enabled：只看「预设里是否存在这类条目」。
  // 以前统计的是启用条目，于是「存在但被禁用」会被当成没有这个条目，
  // 下面的兼容兜底又会把压缩摘要 unshift 进去，禁用配置就失效了。
  const hasCompressionSummaryItem = sortedItems.some(isCompressionSummaryItem);

  // 处理每个条目
  for (const item of sortedItems) {
    // 跳过未启用的条目
    if (!item.enabled) {
      skippedItemIds.push(item.id);
      continue;
    }

    // 压缩摘要条目
    if (isCompressionSummaryItem(item)) {
      if (handledSpecialKinds.has('compression-summary')) {
        skippedItemIds.push(item.id);
        continue;
      }
      handledSpecialKinds.add('compression-summary');

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
      if (handledSpecialKinds.has('chat-history')) {
        skippedItemIds.push(item.id);
        continue;
      }
      handledSpecialKinds.add('chat-history');

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
      if (handledSpecialKinds.has('user-instruction')) {
        skippedItemIds.push(item.id);
        continue;
      }
      handledSpecialKinds.add('user-instruction');

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
