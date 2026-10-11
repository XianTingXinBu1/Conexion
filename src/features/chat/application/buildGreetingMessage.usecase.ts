/**
 * 开场白消息构建
 *
 * 角色卡的开场白（firstMessage / alternateGreetings）在进入角色会话时
 * 作为首条 assistant 消息出现，因此走和 AI 输出完全相同的处理管线：
 * 宏展开（跳过代码区域）+ 助手作用域的正则规则。
 */

import type { AICharacter, Message, RegexRule, UserCharacter } from '@/types';
import { processChatContent } from './chatContentPipeline';

export interface BuildGreetingMessageContext {
  character?: AICharacter;
  userCharacter?: UserCharacter;
  rules?: RegexRule[];
  /** 当前时间，便于测试注入；同时决定消息 id 与时间戳 */
  now?: Date;
  /**
   * 选用第几条开场白：0 = firstMessage，1..n = alternateGreetings[n-1]。
   * 缺省取第一条非空开场白。
   */
  greetingIndex?: number;
}

/**
 * 列出角色可用的开场白（firstMessage 在前，备选在后），过滤空值
 */
export function listGreetings(character?: AICharacter): string[] {
  if (!character) return [];

  return [character.firstMessage, ...(character.alternateGreetings ?? [])]
    .filter((greeting): greeting is string => typeof greeting === 'string')
    .filter(greeting => greeting.trim().length > 0);
}

/**
 * 构建开场白消息；没有可用开场白时返回 null
 */
export function buildGreetingMessage(context: BuildGreetingMessageContext): Message | null {
  const { character, userCharacter, rules = [], now = new Date() } = context;

  const greetings = listGreetings(character);
  const greeting = greetings[context.greetingIndex ?? 0];
  if (!greeting) return null;

  const content = processChatContent(greeting, {
    scope: 'assistant',
    rules,
    macroContext: { aiCharacter: character, userCharacter, now },
  });

  if (!content.trim()) return null;

  return {
    id: `greeting-${now.getTime()}`,
    type: 'assistant',
    content,
    timestamp: now.getTime(),
  };
}
