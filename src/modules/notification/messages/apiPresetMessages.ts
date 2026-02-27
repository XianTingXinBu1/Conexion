import { type NotificationMessage } from './types';

/**
 * API 预设相关通知消息键类型
 */
export type ApiPresetMessageKey =
  | 'API_PRESET_SAVE_SUCCESS'
  | 'API_PRESET_LOAD_SUCCESS'
  | 'API_PRESET_LOAD_FAILED'
  | 'API_PRESET_CONNECTION_SUCCESS'
  | 'API_PRESET_CONNECTION_FAILED';

/**
 * API 预设相关通知消息配置
 */
export const API_PRESET_MESSAGES: Record<ApiPresetMessageKey, (params?: Record<string, string | number>) => NotificationMessage> = {
  /**
   * API 预设保存成功
   */
  API_PRESET_SAVE_SUCCESS: () => ({
    type: 'success',
    title: '保存成功',
    message: '预设已保存',
  }),

  /**
   * API 预设加载成功
   */
  API_PRESET_LOAD_SUCCESS: (params) => ({
    type: 'success',
    title: '加载成功',
    message: `已加载 ${String(params?.count || 0)} 个模型`,
  }),

  /**
   * API 预设加载失败
   */
  API_PRESET_LOAD_FAILED: (params) => ({
    type: 'error',
    title: '加载失败',
    message: String(params?.error || '获取模型列表失败'),
  }),

  /**
   * API 预设连接测试成功
   */
  API_PRESET_CONNECTION_SUCCESS: (params) => ({
    type: 'success',
    title: '连接成功',
    message: `网络延迟: ${String(params?.latency || 0)}ms`,
  }),

  /**
   * API 预设连接测试失败
   */
  API_PRESET_CONNECTION_FAILED: (params) => ({
    type: 'error',
    title: '连接失败',
    message: String(params?.error || '连接测试失败'),
  }),
};