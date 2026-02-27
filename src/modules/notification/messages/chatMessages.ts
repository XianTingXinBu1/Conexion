import { type NotificationMessage } from './types';

/**
 * 聊天相关通知消息键类型
 */
export type ChatMessageKey =
  | 'CHAT_SEND_SUCCESS'
  | 'CHAT_SEND_FAILED'
  | 'CODE_COPY_SUCCESS'
  | 'CODE_COPY_FAILED';

/**
 * 聊天相关通知消息配置
 */
export const CHAT_MESSAGES: Record<ChatMessageKey, (params?: Record<string, string | number>) => NotificationMessage> = {
  /**
   * 聊天消息发送成功
   */
  CHAT_SEND_SUCCESS: () => ({
    type: 'success',
    title: '发送成功',
    message: '消息已发送',
  }),

  /**
   * 聊天消息发送失败
   */
  CHAT_SEND_FAILED: (params) => ({
    type: 'error',
    title: '发送失败',
    message: String(params?.error || '发送失败'),
  }),

  /**
   * 代码复制成功
   */
  CODE_COPY_SUCCESS: () => ({
    type: 'success',
    title: '复制成功',
    message: '代码已复制到剪贴板',
  }),

  /**
   * 代码复制失败
   */
  CODE_COPY_FAILED: (params) => ({
    type: 'error',
    title: '复制失败',
    message: String(params?.error || '无法复制到剪贴板'),
  }),
};