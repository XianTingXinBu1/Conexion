import { type NotificationMessage } from './types';

/**
 * 通用通知消息键类型
 */
export type CommonMessageKey =
  | 'NETWORK_ERROR'
  | 'TIMEOUT_ERROR'
  | 'UNKNOWN_ERROR'
  | 'OPERATION_SUCCESS'
  | 'OPERATION_FAILED'
  | 'LOADING'
  | 'WARNING'
  | 'INFO';

/**
 * 通用通知消息配置
 */
export const COMMON_MESSAGES: Record<CommonMessageKey, (params?: Record<string, string | number>) => NotificationMessage> = {
  /**
   * 网络错误
   */
  NETWORK_ERROR: (params) => ({
    type: 'error',
    title: '网络错误',
    message: String(params?.error || '请检查网络连接'),
  }),

  /**
   * 超时错误
   */
  TIMEOUT_ERROR: (params) => ({
    type: 'error',
    title: '请求超时',
    message: String(params?.error || '请求已超时，请重试'),
  }),

  /**
   * 未知错误
   */
  UNKNOWN_ERROR: (params) => ({
    type: 'error',
    title: '发生错误',
    message: String(params?.error || '未知错误，请重试'),
  }),

  /**
   * 操作成功
   */
  OPERATION_SUCCESS: (params) => ({
    type: 'success',
    title: '操作成功',
    message: String(params?.message || '操作已完成'),
  }),

  /**
   * 操作失败
   */
  OPERATION_FAILED: (params) => ({
    type: 'error',
    title: '操作失败',
    message: String(params?.error || '操作未完成，请重试'),
  }),

  /**
   * 加载中提示
   */
  LOADING: (params) => ({
    type: 'info',
    title: '加载中',
    message: String(params?.message || '请稍候...'),
  }),

  /**
   * 警告提示
   */
  WARNING: (params) => ({
    type: 'warning',
    title: '警告',
    message: String(params?.message || '请注意'),
  }),

  /**
   * 信息提示
   */
  INFO: (params) => ({
    type: 'info',
    title: '提示',
    message: String(params?.message || '操作已完成'),
  }),
};