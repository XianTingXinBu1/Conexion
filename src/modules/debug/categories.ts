import type { DebugCategory } from './types';
import { log, logGroup } from './logger';

/**
 * 创建分类日志函数
 */
function createCategoryLogger(category: DebugCategory) {
  return {
    /**
     * 普通日志
     */
    log: (message: string, data?: unknown) => {
      log('log', category, message, data);
    },

    /**
     * 警告日志
     */
    warn: (message: string, data?: unknown) => {
      log('warn', category, message, data);
    },

    /**
     * 错误日志
     */
    error: (message: string, data?: unknown) => {
      log('error', category, message, data);
    },

    /**
     * 信息日志
     */
    info: (message: string, data?: unknown) => {
      log('info', category, message, data);
    },
  };
}

/**
 * API 分类日志
 */
export const apiLogger = createCategoryLogger('API');

/**
 * 预设分类日志
 */
export const presetLogger = createCategoryLogger('PRESET');

/**
 * 提示词分类日志
 */
export const promptLogger = createCategoryLogger('PROMPT');

/**
 * 会话分类日志
 */
export const conversationLogger = createCategoryLogger('CONVERSATION');

/**
 * 系统分类日志
 */
export const systemLogger = createCategoryLogger('SYSTEM');

/**
 * 通用分类日志
 */
export const generalLogger = createCategoryLogger('GENERAL');

/**
 * 便捷方法 - API 相关
 */
export const logApi = apiLogger.log;
export const logApiWarn = apiLogger.warn;
export const logApiError = apiLogger.error;

/**
 * 便捷方法 - 预设相关
 */
export const logPreset = presetLogger.log;
export const logPresetWarn = presetLogger.warn;

/**
 * 便捷方法 - 提示词相关
 */
export const logPrompt = promptLogger.log;
export const logPromptWarn = promptLogger.warn;

/**
 * 便捷方法 - 会话相关
 */
export const logConversation = conversationLogger.log;

/**
 * 便捷方法 - 系统相关
 */
export const logSystem = systemLogger.log;
export const logSystemWarn = systemLogger.warn;
export const logSystemError = systemLogger.error;

/**
 * 便捷方法 - 显示预设
 */
export const logCurrentPreset = (preset: unknown) => {
  logGroup('PRESET', '当前 API 预设', preset);
};

/**
 * 便捷方法 - 显示系统提示词
 */
export const logSystemPrompt = (promptData: {
  presetName: string;
  messageCount: number;
  usedItems: number;
  skippedItems: number;
  estimatedTokens: number;
  userInstructionIncluded: boolean;
  allItems?: Array<{ id: string; name: string; enabled: boolean; insertPosition: number | undefined }>;
  enabledItems?: Array<{ id: string; name: string; insertPosition: number | undefined }>;
  messages?: Array<{ role: string; content: string }>;
}) => {
  logGroup('PROMPT', '系统提示词构建', {
    '预设名称': promptData.presetName,
    '消息数量': promptData.messageCount,
    '使用条目': promptData.usedItems,
    '跳过条目': promptData.skippedItems,
    '估算 Token': promptData.estimatedTokens,
    '包含用户指令': promptData.userInstructionIncluded,
  });

  // 显示所有预设条目
  if (promptData.allItems) {
    logGroup('PROMPT', '所有预设条目', promptData.allItems.map(item => ({
      id: item.id,
      name: item.name,
      enabled: item.enabled ? '✓' : '✗',
      position: item.insertPosition,
    })));
  }

  // 显示启用的预设条目
  if (promptData.enabledItems) {
    logGroup('PROMPT', '启用的预设条目', promptData.enabledItems.map(item => ({
      id: item.id,
      name: item.name,
      position: item.insertPosition,
    })));
  }

  // 显示构建的提示词数组
  if (promptData.messages) {
    logGroup('PROMPT', '构建的提示词数组', promptData.messages.map((msg, index) => ({
      index: index + 1,
      role: msg.role,
      content: msg.content.slice(0, 100) + (msg.content.length > 100 ? '...' : ''),
      contentLength: msg.content.length,
    })));
  }
};

/**
 * 便捷方法 - 显示知识库内容
 */
export const logKnowledgeBase = (kbData: unknown) => {
  logGroup('PROMPT', '知识库内容', kbData);
};

/**
 * 便捷方法 - 显示 API 请求
 */
export const logApiRequest = (request: unknown) => {
  logGroup('API', 'API 请求', request);
};

/**
 * 便捷方法 - 显示 API 响应
 */
export const logApiResponse = (response: unknown) => {
  logGroup('API', 'API 响应', response);
};

/**
 * 便捷方法 - 显示会话信息
 */
export const logConversationInfo = (conversation: unknown) => {
  logGroup('CONVERSATION', '会话信息', conversation);
};