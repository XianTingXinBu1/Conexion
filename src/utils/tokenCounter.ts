import { encode } from 'gpt-tokenizer';

/**
 * 计算文本的 token 数量
 */
export function countTokens(text: string): number {
  if (!text) return 0;
  return encode(text).length;
}

const MESSAGE_OVERHEAD = 4;

/**
 * 计算单条消息的 token 数量
 */
export function countMessageTokens(_role: string, content: string): number {
  return countTokens(content) + MESSAGE_OVERHEAD;
}

/**
 * 计算消息列表的总 token 数量
 */
export function countMessagesTokens(messages: Array<{ role: string; content: string }>): number {
  return messages.reduce((total, message) => {
    return total + countMessageTokens(message.role, message.content);
  }, 0);
}
