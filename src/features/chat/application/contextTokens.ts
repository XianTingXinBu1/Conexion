import type { ChatMessage } from '@/types';
import { countMessagesTokens } from '@/utils/tokenCounter';

export interface ContextTokenBaseline {
  model: string;
  baseURL: string;
  messages: ChatMessage[];
  promptTokens: number;
}

export type ContextTokenSource = 'api' | 'api-with-estimate' | 'estimate';

/** Only reuse measured input when the current prompt contains that exact input prefix.
 * Output usage may include reasoning tokens, so additions are always counted locally.
 */
export function resolveContextTokens(
  messages: ChatMessage[],
  baseline: ContextTokenBaseline | null,
  model?: string,
  baseURL?: string,
): { tokens: number; source: ContextTokenSource } {
  const matches = baseline && baseline.model === model && baseline.baseURL === baseURL
    && Number.isFinite(baseline.promptTokens) && baseline.promptTokens >= 0
    && baseline.messages.length <= messages.length
    && baseline.messages.every((message, index) =>
      message.role === messages[index]?.role && message.content === messages[index]?.content);

  if (!matches) return { tokens: countMessagesTokens(messages), source: 'estimate' };
  const additions = messages.slice(baseline.messages.length);
  return {
    tokens: baseline.promptTokens + countMessagesTokens(additions),
    source: additions.length ? 'api-with-estimate' : 'api',
  };
}
