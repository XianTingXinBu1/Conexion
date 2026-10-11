/**
 * 聊天内容处理管线
 *
 * 用户输入与 AI 输出走同一条管线，让「正则应用时机」真正有意义：
 *
 *   原文 --[before-macro 规则]--> 宏展开 --> [after-macro 规则] --> 落库 / 展示
 *
 * 约定：
 * - 每条规则只会执行一次（before-macro 与 after-macro 互斥）。
 * - 宏只展开一次，位于两个阶段之间：after-macro 规则替换出来的 `{{char}}`
 *   不会被再次展开，行为可预期。
 * - 宏展开跳过代码区域（fenced 代码块与行内代码）。`{{ user }}` 这类
 *   模板代码示例在聊天里很常见，不能被当成宏替换掉。
 * - 展开结果直接落库，保证「看到的 = 存下的 = 发给上游的」三者一致。
 */

import type { RegexRule } from '@/types';
import type { MacroContext } from '@/modules/system-prompt';
import { applyRules } from '@/utils/regexEngine';
import { mapNonCode } from '@/modules/markdown/segments';
import { renderMacros } from '@/modules/system-prompt/core/macro';

export type ChatContentScope = 'user' | 'assistant';

export interface ProcessChatContentOptions {
  /** 消息方向：用户输入还是 AI 输出 */
  scope: ChatContentScope;
  rules: RegexRule[];
  /** 宏上下文；由发送方在本次回合开始时固定，避免流式期间时间漂移 */
  macroContext: MacroContext;
}

/**
 * 处理一条聊天消息内容
 */
export function processChatContent(text: string, options: ProcessChatContentOptions): string {
  const { scope, rules, macroContext } = options;

  const afterBeforeMacroRules = applyRules(text, scope, 'before-macro', rules);
  const expanded = mapNonCode(afterBeforeMacroRules, segment => renderMacros(segment, macroContext));

  return applyRules(expanded, scope, 'after-macro', rules);
}
