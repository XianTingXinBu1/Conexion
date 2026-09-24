/**
 * 提示词宏（变量）的前端展示配置
 *
 * 与 src/modules/system-prompt/core/macro.ts 的运行时变量保持一致。
 * 这里只负责 UI 展示与插入，不参与实际替换。
 */

export interface MacroHint {
  /** 插入到提示词中的变量 token */
  token: string;
  /** 悬浮提示 */
  label: string;
}

export const PROMPT_MACRO_HINTS: readonly MacroHint[] = [
  { token: '{{char}}', label: 'AI 角色名' },
  { token: '{{user}}', label: '用户角色名' },
  { token: '{{description}}', label: 'AI 角色描述' },
  { token: '{{personality}}', label: 'AI 角色性格' },
  { token: '{{user_description}}', label: '用户描述' },
  { token: '{{time}}', label: '实时日期时间' },
  { token: '{{date}}', label: '实时日期' },
  { token: '{{weekday}}', label: '实时星期' },
  { token: '{{hour}}', label: '实时小时' },
];
