/**
 * 调试日志模块入口
 */

// 导出类型
export type { DebugLevel, DebugCategory, DebugLogItem } from './types';

// 导出核心日志器
export {
  formatTimestamp,
  getLevelStyle,
  getCategoryIcon,
  log,
  logGroup,
  logGroupCollapsed,
  getLogHistory,
  clearLogHistory,
  exportLogHistory,
  showDebugHelp,
  setDebugMode,
  getDebugMode,
} from './logger';

// 导出分类日志
export {
  apiLogger,
  presetLogger,
  promptLogger,
  conversationLogger,
  systemLogger,
  generalLogger,
  logApi,
  logApiWarn,
  logApiError,
  logPreset,
  logPresetWarn,
  logPrompt,
  logPromptWarn,
  logConversation,
  logSystem,
  logSystemWarn,
  logSystemError,
  logCurrentPreset,
  logSystemPrompt,
  logKnowledgeBase,
  logApiRequest,
  logApiResponse,
  logConversationInfo,
} from './categories';