import type { ChatMessage, ConversationCompression, Message } from '@/types';
import { countMessageTokens } from './tokenCounter';

export const DEFAULT_COMPRESSION_KEEP_RECENT_MESSAGES = 6;
export const MIN_COMPRESSION_THRESHOLD_PERCENT = 50;
export const MAX_COMPRESSION_THRESHOLD_PERCENT = 95;

const COMPRESSION_SYSTEM_PROMPT = [
  '你是一个会话压缩助手。',
  '请将给定对话压缩为忠实、简洁、可供后续对话继续使用的中文摘要。',
  '只保留对未来回复有帮助的信息，重点总结：关键事实、用户偏好、已做决定、未完成事项、重要约束、当前任务进度。',
  '不要编造，不要加入对话中不存在的新信息。',
  '输出请使用简明项目符号。',
].join('');

export function clampCompressionThresholdPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 75;
  }

  return Math.min(
    MAX_COMPRESSION_THRESHOLD_PERCENT,
    Math.max(MIN_COMPRESSION_THRESHOLD_PERCENT, Math.round(value))
  );
}

export function getContextUsagePercent(currentTokens: number, maxTokens: number): number {
  if (maxTokens <= 0) {
    return 0;
  }

  return Math.min(100, Math.max(0, Math.round((currentTokens / maxTokens) * 100)));
}

export function isCompressionThresholdReached(
  currentTokens: number,
  maxTokens: number,
  thresholdPercent: number,
): boolean {
  return getContextUsagePercent(currentTokens, maxTokens) >= clampCompressionThresholdPercent(thresholdPercent);
}

export function splitMessagesForCompression(
  messages: Message[],
  keepRecentCount = DEFAULT_COMPRESSION_KEEP_RECENT_MESSAGES,
) {
  const safeKeepRecentCount = Math.max(2, keepRecentCount);

  if (messages.length <= safeKeepRecentCount) {
    return {
      compressibleMessages: [] as Message[],
      retainedMessages: [...messages],
      keepRecentCount: safeKeepRecentCount,
    };
  }

  return {
    compressibleMessages: messages.slice(0, -safeKeepRecentCount),
    retainedMessages: messages.slice(-safeKeepRecentCount),
    keepRecentCount: safeKeepRecentCount,
  };
}

export function canCompressMessages(messages: Message[], keepRecentCount = DEFAULT_COMPRESSION_KEEP_RECENT_MESSAGES): boolean {
  return splitMessagesForCompression(messages, keepRecentCount).compressibleMessages.length > 0;
}

export function formatCompressionSummaryForPrompt(summary: string): string {
  const normalized = summary.trim();
  if (!normalized) {
    return '';
  }

  return [
    '以下是本会话已压缩的历史摘要，请将其视为此前对话上下文，并在后续回答中保持连续性：',
    normalized,
  ].join('\n');
}

export function getCompressionSummaryTokenCount(summary: string): number {
  const promptContent = formatCompressionSummaryForPrompt(summary);
  if (!promptContent) {
    return 0;
  }

  return countMessageTokens('system', promptContent);
}

export function getEffectiveChatHistory(
  messages: Message[],
  compression?: ConversationCompression,
): Message[] {
  if (!compression?.sourceMessageIds?.length) {
    return [...messages];
  }

  const compressedSourceIds = new Set(compression.sourceMessageIds);
  return messages.filter(message => !compressedSourceIds.has(message.id));
}

export function getEffectiveConversationTokenCount(
  messages: Message[],
  compression?: ConversationCompression,
): number {
  const activeMessages = getEffectiveChatHistory(messages, compression);
  const messagesTokenCount = activeMessages.reduce((total, message) => {
    const role = message.type === 'user' ? 'user' : 'assistant';
    return total + countMessageTokens(role, message.content);
  }, 0);

  const summaryTokenCount = compression?.promptContent
    ? countMessageTokens('system', compression.promptContent)
    : 0;

  return messagesTokenCount + summaryTokenCount;
}

export function buildCompressionSystemMessages(existingSummary?: string): ChatMessage[] {
  const systemMessages: ChatMessage[] = [
    {
      role: 'system',
      content: COMPRESSION_SYSTEM_PROMPT,
    },
  ];

  const normalizedSummary = existingSummary?.trim();
  if (normalizedSummary) {
    systemMessages.push({
      role: 'system',
      content: `以下是此前已有的历史摘要，请与本次对话内容合并、去重，并保留仍然有效的信息：\n${normalizedSummary}`,
    });
  }

  return systemMessages;
}
