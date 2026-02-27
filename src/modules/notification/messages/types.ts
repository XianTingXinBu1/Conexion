import type { NotificationType } from '../types';

/**
 * 通知消息模板接口
 */
export interface NotificationMessage {
  title: string;
  message?: string;
  type: NotificationType;
  duration?: number;
}