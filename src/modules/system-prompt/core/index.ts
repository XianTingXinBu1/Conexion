/**
 * 系统提示词构建模块 - 核心功能导出
 */

export { buildSystemPrompt } from './builder';
export { fillItemContent, isChatHistoryItem, isUserInstructionItem, isCompressionSummaryItem } from './content-filler';
export { mergeMessages, mergeAdjacentMessages, mergeAllMessages } from './merger';
export { applyMacros, renderMacros, buildMacroValues, SUPPORTED_MACROS, MACRO_DEFINITIONS, DISPLAYED_MACROS } from './macro';
export type { MacroDefinition } from '../types';