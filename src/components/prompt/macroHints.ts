/**
 * 提示词宏（变量）的前端展示配置
 *
 * 单一真源在 `src/modules/system-prompt/core/macro.ts` 的 MACRO_DEFINITIONS，
 * 这里只做 UI 映射（token + 悬浮提示），不再手工维护第二份变量表。
 */

import { DISPLAYED_MACROS } from '@/modules/system-prompt/core/macro';

export interface MacroHint {
  /** 插入到提示词中的变量 token */
  token: string;
  /** 悬浮提示 */
  label: string;
}

export const PROMPT_MACRO_HINTS: readonly MacroHint[] = DISPLAYED_MACROS.map(definition => ({
  token: `{{${definition.name}}}`,
  label: definition.label,
}));
