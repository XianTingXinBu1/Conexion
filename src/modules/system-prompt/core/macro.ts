/**
 * 系统提示词构建模块 - 宏（变量）替换器
 *
 * 负责把自定义提示词内容中的 {{...}} 变量替换为运行时数据，
 * 覆盖角色卡设定、用户设定、主提示词等普通条目。
 *
 * 作用域约定：宏只展开**作者写的提示词文本**（条目 prompt 与内置模板本身）。
 * 通过槽位注入的运行时数据（角色字段、知识库正文、压缩摘要等）一律按原样写入，
 * 不做二次展开，避免数据里的 `{{...}}` 被误替换。
 *
 * 支持的变量见 MACRO_DEFINITIONS（单一真源）：
 * - {{char}} / {{charname}}  AI 角色名
 * - {{user}} / {{username}}  用户角色名
 * - {{description}}       AI 角色描述
 * - {{personality}}       AI 角色性格
 * - {{user_description}}  用户描述
 * - {{time}}              实时日期时间（YYYY-MM-DD HH:mm:ss）
 * - {{date}}              实时日期（YYYY-MM-DD）
 * - {{weekday}}           实时星期（中文）
 * - {{hour}}              实时小时（00-23）
 */

import type { MacroContext, MacroDefinition, MacroVariableName } from '../types';

/**
 * 支持的宏变量定义表（单一真源）
 */
export const MACRO_DEFINITIONS: readonly MacroDefinition[] = [
  { name: 'char', label: 'AI 角色名' },
  { name: 'charname', label: 'AI 角色名（别名）', aliasOf: 'char' },
  { name: 'user', label: '用户角色名' },
  { name: 'username', label: '用户角色名（别名）', aliasOf: 'user' },
  { name: 'description', label: 'AI 角色描述' },
  { name: 'personality', label: 'AI 角色性格' },
  { name: 'scenario', label: 'AI 角色场景' },
  { name: 'example_dialogue', label: 'AI 角色对话示例' },
  { name: 'user_description', label: '用户描述' },
  { name: 'time', label: '实时日期时间' },
  { name: 'date', label: '实时日期' },
  { name: 'weekday', label: '实时星期' },
  { name: 'hour', label: '实时小时' },
] as const;

/**
 * 支持的宏变量名列表（用于文档与测试，由 MACRO_DEFINITIONS 派生）
 */
export const SUPPORTED_MACROS: readonly MacroVariableName[] = MACRO_DEFINITIONS.map(
  definition => definition.name
);

/**
 * 需要展示为 chip 的宏（排除别名）
 */
export const DISPLAYED_MACROS: readonly MacroDefinition[] = MACRO_DEFINITIONS.filter(
  definition => !definition.aliasOf
);

const WEEKDAY_LABELS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'] as const;

function pad2(value: number): string {
  return value.toString().padStart(2, '0');
}

/**
 * 格式化实时时间数据
 */
function formatNow(now: Date): {
  time: string;
  date: string;
  weekday: string;
  hour: string;
} {
  const year = now.getFullYear();
  const month = pad2(now.getMonth() + 1);
  const day = pad2(now.getDate());
  const hours = pad2(now.getHours());
  const minutes = pad2(now.getMinutes());
  const seconds = pad2(now.getSeconds());

  return {
    time: `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`,
    date: `${year}-${month}-${day}`,
    weekday: WEEKDAY_LABELS[now.getDay()] ?? '',
    hour: hours,
  };
}

/**
 * 构建宏变量取值表
 */
export function buildMacroValues(context: MacroContext): Record<MacroVariableName, string> {
  const { aiCharacter, userCharacter, now = new Date() } = context;
  const timeValues = formatNow(now);

  const aiName = aiCharacter?.name ?? '';
  const userName = userCharacter?.name ?? '';
  const aiDescription = aiCharacter?.description ?? '';
  const aiPersonality = aiCharacter?.personality ?? '';
  const aiScenario = aiCharacter?.scenario ?? '';
  const aiExampleDialogue = aiCharacter?.exampleDialogue ?? '';
  const userDescription = userCharacter?.description ?? '';

  return {
    char: aiName,
    charname: aiName,
    user: userName,
    username: userName,
    description: aiDescription,
    personality: aiPersonality,
    scenario: aiScenario,
    example_dialogue: aiExampleDialogue,
    user_description: userDescription,
    time: timeValues.time,
    date: timeValues.date,
    weekday: timeValues.weekday,
    hour: timeValues.hour,
  };
}

const MACRO_PATTERN = /\{\{\s*([a-zA-Z_]+)\s*\}\}/g;

/**
 * 对文本执行宏替换。
 * 未识别的变量保持原样，避免误伤普通 {{...}} 文本。
 */
export function applyMacros(text: string, values: Record<MacroVariableName, string>): string {
  if (!text || !text.includes('{{')) return text;

  return text.replace(MACRO_PATTERN, (match, rawKey: string) => {
    const key = rawKey.toLowerCase() as MacroVariableName;
    if (Object.prototype.hasOwnProperty.call(values, key)) {
      return values[key];
    }
    return match;
  });
}

/**
 * 便捷入口：直接对文本应用宏替换
 */
export function renderMacros(text: string, context: MacroContext): string {
  return applyMacros(text, buildMacroValues(context));
}
