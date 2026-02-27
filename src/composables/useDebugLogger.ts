import { ref, watch } from 'vue';
import { useLocalStorage } from './useLocalStorage';
import { STORAGE_KEYS } from '../constants';
import {
  log as coreLog,
  logGroup,
  logGroupCollapsed,
  getLogHistory,
  clearLogHistory as coreClearLogHistory,
  exportLogHistory as coreExportLogHistory,
  showDebugHelp as coreShowDebugHelp,
  setDebugMode,
  type DebugLogItem,
} from '../modules/debug';

/**
 * 调试日志级别
 */
export type DebugLevel = 'log' | 'warn' | 'error' | 'info';

/**
 * 调试分类
 */
export type DebugCategory = 'API' | 'PRESET' | 'PROMPT' | 'CONVERSATION' | 'SYSTEM' | 'GENERAL';

/**
 * 调试日志器 composable
 * 提供调试模式开关和基于 Vue 响应式的日志历史
 */
export function useDebugLogger() {
  // 调试模式开关
  const { value: debugMode } = useLocalStorage(STORAGE_KEYS.DEBUG_MODE, false);

  // 日志历史（响应式，用于 UI 显示）
  const logHistory = ref<DebugLogItem[]>([]);

  // 同步日志历史到响应式状态
  const syncLogHistory = () => {
    logHistory.value = getLogHistory();
  };

  // 监听调试模式变化，同步到模块并显示帮助
  watch(debugMode, (newVal) => {
    setDebugMode(newVal);
    if (newVal) {
      syncLogHistory();
      coreShowDebugHelp();
    }
  }, { immediate: true });

  /**
   * 核心日志函数（带调试模式检查）
   */
  const log = (
    level: DebugLevel,
    category: DebugCategory,
    message: string,
    data?: unknown
  ) => {
    if (!debugMode.value) return;
    coreLog(level, category, message, data);
    syncLogHistory();
  };

  /**
   * 分组显示复杂对象（带调试模式检查）
   */
  const groupLog = (category: DebugCategory, title: string, data: unknown) => {
    if (!debugMode.value) return;
    logGroup(category, title, data);
  };

  /**
   * 分组显示可折叠的内容（带调试模式检查）
   */
  const groupCollapsedLog = (category: DebugCategory, title: string, data: unknown) => {
    if (!debugMode.value) return;
    logGroupCollapsed(category, title, data);
  };

  /**
   * API 相关日志
   */
  const logApi = (message: string, data?: unknown) => log('log', 'API', message, data);
  const logApiWarn = (message: string, data?: unknown) => log('warn', 'API', message, data);
  const logApiError = (message: string, data?: unknown) => log('error', 'API', message, data);

  /**
   * 预设相关日志
   */
  const logPreset = (message: string, data?: unknown) => log('log', 'PRESET', message, data);
  const logPresetWarn = (message: string, data?: unknown) => log('warn', 'PRESET', message, data);

  /**
   * 提示词相关日志
   */
  const logPrompt = (message: string, data?: unknown) => log('log', 'PROMPT', message, data);
  const logPromptWarn = (message: string, data?: unknown) => log('warn', 'PROMPT', message, data);

  /**
   * 会话相关日志
   */
  const logConversation = (message: string, data?: unknown) => log('log', 'CONVERSATION', message, data);

  /**
   * 系统相关日志
   */
  const logSystem = (message: string, data?: unknown) => log('log', 'SYSTEM', message, data);
  const logSystemWarn = (message: string, data?: unknown) => log('warn', 'SYSTEM', message, data);
  const logSystemError = (message: string, data?: unknown) => log('error', 'SYSTEM', message, data);

  /**
   * 显示当前 API 预设
   */
  const logCurrentPreset = (preset: unknown) => groupLog('PRESET', '当前 API 预设', preset);

  /**
   * 显示系统提示词
   */
  const logSystemPrompt = (promptData: unknown) => groupLog('PROMPT', '系统提示词', promptData);

  /**
   * 显示知识库内容
   */
  const logKnowledgeBase = (kbData: unknown) => groupLog('PROMPT', '知识库内容', kbData);

  /**
   * 显示 API 请求
   */
  const logApiRequest = (request: unknown) => groupLog('API', 'API 请求', request);

  /**
   * 显示 API 响应
   */
  const logApiResponse = (response: unknown) => groupLog('API', 'API 响应', response);

  /**
   * 显示会话信息
   */
  const logConversationInfo = (conversation: unknown) => groupLog('CONVERSATION', '会话信息', conversation);

  /**
   * 清空日志历史
   */
  const clearLogHistory = () => {
    coreClearLogHistory();
    syncLogHistory();
  };

  /**
   * 导出日志历史
   */
  const exportLogHistory = () => {
    coreExportLogHistory();
  };

  /**
   * 显示调试帮助信息
   */
  const showDebugHelp = () => {
    coreShowDebugHelp();
  };

  return {
    debugMode,
    logHistory,

    // 通用日志
    log,
    logGroup: groupLog,
    logGroupCollapsed: groupCollapsedLog,

    // API 日志
    logApi,
    logApiWarn,
    logApiError,
    logApiRequest,
    logApiResponse,

    // 预设日志
    logPreset,
    logPresetWarn,
    logCurrentPreset,

    // 提示词日志
    logPrompt,
    logPromptWarn,
    logSystemPrompt,
    logKnowledgeBase,

    // 会话日志
    logConversation,
    logConversationInfo,

    // 系统日志
    logSystem,
    logSystemWarn,
    logSystemError,

    // 工具方法
    clearLogHistory,
    exportLogHistory,
    showDebugHelp,
  };
}