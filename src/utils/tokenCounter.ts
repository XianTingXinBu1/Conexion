import { encode } from 'gpt-tokenizer';

/**
 * 计算文本的 token 数量
 */
export function countTokens(text: string): number {
  if (!text) return 0;
  return encode(text).length;
}

/**
 * 计算消息列表的总 token 数量
 */
export function countMessagesTokens(messages: Array<{ role: string; content: string }>): number {
  // 系统消息的固定开销（约为 4 tokens）
  const MESSAGE_OVERHEAD = 4;

  return messages.reduce((total, message) => {
    return total + countTokens(message.content) + MESSAGE_OVERHEAD;
  }, 0);
}