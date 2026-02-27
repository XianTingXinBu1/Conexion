import type { DebugLevel, DebugCategory, DebugLogItem } from './types';

/**
 * 调试日志历史最大数量
 */
const MAX_LOG_HISTORY = 100;

/**
 * 日志历史记录
 */
const logHistory: DebugLogItem[] = [];

/**
 * 调试模式全局状态
 */
let debugMode = false;

/**
 * 设置调试模式
 */
export function setDebugMode(enabled: boolean): void {
  debugMode = enabled;
}

/**
 * 获取调试模式状态
 */
export function getDebugMode(): boolean {
  return debugMode;
}

/**
 * 格式化时间戳
 */
export function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${date.getMilliseconds().toString().padStart(3, '0')}`;
}

/**
 * 获取日志级别的颜色样式
 */
export function getLevelStyle(level: DebugLevel): string {
  const styles = {
    log: 'color: #6366f1', // indigo-500
    warn: 'color: #f59e0b', // amber-500
    error: 'color: #ef4444', // red-500
    info: 'color: #3b82f6', // blue-500
  };
  return styles[level];
}

/**
 * 获取分类的图标
 */
export function getCategoryIcon(category: DebugCategory): string {
  const icons = {
    API: '🔌',
    PRESET: '⚙️',
    PROMPT: '📝',
    CONVERSATION: '💬',
    SYSTEM: '⚙️',
    GENERAL: 'ℹ️',
  };
  return icons[category];
}

/**
 * 核心日志函数
 */
export function log(
  level: DebugLevel,
  category: DebugCategory,
  message: string,
  data?: unknown
) {
  if (!debugMode) return;

  const timestamp = Date.now();
  const logItem: DebugLogItem = {
    timestamp,
    level,
    category,
    message,
    data,
  };

  // 添加到历史记录
  logHistory.push(logItem);
  if (logHistory.length > MAX_LOG_HISTORY) {
    logHistory.shift();
  }

  // 控制台输出
  const timeStr = formatTimestamp(timestamp);
  const icon = getCategoryIcon(category);
  const levelStyle = getLevelStyle(level);
  const categoryStyle = 'color: #9333ea; font-weight: bold;'; // purple-600

  console[level](`%c[${timeStr}]%c ${icon} %c[${category}]%c ${message}`,
    'color: #9ca3af; font-size: 11px;', // gray-400
    '',
    categoryStyle,
    levelStyle,
    data
  );
}

/**
 * 分组显示复杂对象
 */
export function logGroup(category: DebugCategory, title: string, data: unknown) {
  if (!debugMode) return;

  const icon = getCategoryIcon(category);
  const style = 'color: #9333ea; font-weight: bold; font-size: 14px;';

  console.group(`%c${icon} [${category}] ${title}`, style);
  console.log(data);
  console.groupEnd();
}

/**
 * 分组显示可折叠的内容
 */
export function logGroupCollapsed(category: DebugCategory, title: string, data: unknown) {
  if (!debugMode) return;

  const icon = getCategoryIcon(category);
  const style = 'color: #9333ea; font-weight: bold; font-size: 14px;';

  console.groupCollapsed(`%c${icon} [${category}] ${title}`, style);
  console.log(data);
  console.groupEnd();
}

/**
 * 获取日志历史
 */
export function getLogHistory(): DebugLogItem[] {
  return [...logHistory];
}

/**
 * 清空日志历史
 */
export function clearLogHistory() {
  logHistory.length = 0;
  console.log('🗑️ 日志历史已清空');
}

/**
 * 导出日志历史
 */
export function exportLogHistory() {
  console.table(logHistory);
}

/**
 * 显示调试帮助信息
 */
export function showDebugHelp() {
  console.group('%c🔧 Conexion 调试帮助', 'color: #9333ea; font-size: 16px; font-weight: bold;');
  console.log('%c使用方法:', 'font-weight: bold;');
  console.log('  1. 在设置中开启"调试模式"');
  console.log('  2. 使用以下方法记录日志:');
  console.log('     - logApi(message, data) - API 日志');
  console.log('     - logPreset(message, data) - 预设日志');
  console.log('     - logPrompt(message, data) - 提示词日志');
  console.log('     - logConversation(message, data) - 会话日志');
  console.log('     - logSystem(message, data) - 系统日志');
  console.log('  3. 使用分组显示:');
  console.log('     - logCurrentPreset(preset) - 显示当前预设');
  console.log('     - logSystemPrompt(prompt) - 显示系统提示词');
  console.log('     - logApiRequest(req) - 显示 API 请求');
  console.log('     - logApiResponse(res) - 显示 API 响应');
  console.log('  4. 其他工具:');
  console.log('     - exportLogHistory() - 导出日志历史为表格');
  console.log('     - clearLogHistory() - 清空日志历史');
  console.groupEnd();
}