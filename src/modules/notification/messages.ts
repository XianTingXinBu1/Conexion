/**
 * 通知消息配置
 *
 * 集中管理所有通知消息的文本内容
 * 便于统一修改和维护
 */

import type { NotificationType } from './types';
import { API_PRESET_MESSAGES, type ApiPresetMessageKey } from './messages/apiPresetMessages';
import { CHAT_MESSAGES, type ChatMessageKey } from './messages/chatMessages';
import { MANAGEMENT_MESSAGES, type ManagementMessageKey } from './messages/managementMessages';
import { COMMON_MESSAGES, type CommonMessageKey } from './messages/commonMessages';

/**
 * 通知消息模板接口
 */
export interface NotificationMessage {
  title: string;
  message?: string;
  type: NotificationType;
  duration?: number;
}

/**
 * 通知消息键类型（合并所有子模块的消息键）
 */
export type NotificationMessageKey = ApiPresetMessageKey | ChatMessageKey | ManagementMessageKey | CommonMessageKey;

/**
 * 通知消息配置对象（合并所有子模块的消息）
 */
export const NOTIFICATION_MESSAGES: Record<NotificationMessageKey, (params?: Record<string, string | number>) => NotificationMessage> = {
  ...API_PRESET_MESSAGES,
  ...CHAT_MESSAGES,
  ...MANAGEMENT_MESSAGES,
  ...COMMON_MESSAGES,
};

/**
 * 获取通知消息
 *
 * @param key 通知消息键
 * @param params 消息参数
 * @returns 通知消息对象
 */
export function getNotificationMessage(
  key: NotificationMessageKey,
  params?: Record<string, string | number>
): NotificationMessage {
  return NOTIFICATION_MESSAGES[key](params);
}