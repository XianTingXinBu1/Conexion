/**
 * 通知系统类型定义
 *
 * 定义通知相关的类型接口
 */

/**
 * 通知类型
 */
export type NotificationType = 'info' | 'warning' | 'error' | 'success';

/**
 * 通知项接口
 */
export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  duration?: number;
  onClick?: () => void;
  renderMarkdown?: boolean;  // 是否渲染 markdown
  paused?: boolean;         // 是否暂停自动关闭
}