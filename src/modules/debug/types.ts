/**
 * 调试日志级别
 */
export type DebugLevel = 'log' | 'warn' | 'error' | 'info';

/**
 * 调试分类
 */
export type DebugCategory = 'API' | 'PRESET' | 'PROMPT' | 'CONVERSATION' | 'SYSTEM' | 'GENERAL';

/**
 * 调试日志项
 */
export interface DebugLogItem {
  timestamp: number;
  level: DebugLevel;
  category: DebugCategory;
  message: string;
  data?: unknown;
}