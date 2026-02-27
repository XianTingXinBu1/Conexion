import { ref, computed } from 'vue';
import type { NotificationItem, NotificationType } from './types';

/**
 * 通知管理 Composable（全局单例）
 *
 * 提供通知的添加、删除、队列管理等功能
 * 所有组件共享同一个通知状态实例
 */

// ==================== 全局单例状态 ====================

// 通知列表（当前显示的通知）
const notifications = ref<NotificationItem[]>([]);

// 通知队列（等待显示的通知）
const queue = ref<NotificationItem[]>([]);

// 最大显示数量
const MAX_NOTIFICATIONS = 3;

// 默认持续时间
const DEFAULT_DURATION = 3000;

// 定时器映射
const timers = new Map<string, number>();

// ==================== 核心方法 ====================

/**
 * 生成唯一ID
 */
const generateId = () => `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

/**
 * 添加通知
 */
const addNotification = (
  type: NotificationType,
  title: string,
  message?: string,
  options?: {
    duration?: number;
    onClick?: () => void;
    renderMarkdown?: boolean;
  }
) => {
  const notification: NotificationItem = {
    id: generateId(),
    type,
    title,
    message,
    duration: options?.duration ?? DEFAULT_DURATION,
    onClick: options?.onClick,
    renderMarkdown: options?.renderMarkdown,
    paused: false,
  };

  // 如果当前通知数量未达到上限，直接添加
  if (notifications.value.length < MAX_NOTIFICATIONS) {
    notifications.value.unshift(notification);

    // 设置自动关闭定时器
    if (notification.duration && notification.duration > 0) {
      const timer = setTimeout(() => {
        removeNotification(notification.id);
      }, notification.duration);
      timers.set(notification.id, timer);
    }
  } else {
    // 添加到队列
    queue.value.push(notification);
  }

  return notification.id;
};

/**
 * 删除通知
 */
const removeNotification = (id: string) => {
  // 清除定时器
  const timer = timers.get(id);
  if (timer) {
    clearTimeout(timer);
    timers.delete(id);
  }

  // 从列表中删除
  const index = notifications.value.findIndex(n => n.id === id);
  if (index !== -1) {
    notifications.value.splice(index, 1);

    // 从队列中取出下一个通知
    processQueue();
  }
};

/**
 * 暂停通知自动关闭
 */
const pauseNotification = (id: string) => {
  // 清除定时器
  const timer = timers.get(id);
  if (timer) {
    clearTimeout(timer);
    timers.delete(id);
  }

  // 标记为暂停状态
  const notification = notifications.value.find(n => n.id === id);
  if (notification) {
    notification.paused = true;
  }
};

/**
 * 恢复通知自动关闭
 */
const resumeNotification = (id: string) => {
  const notification = notifications.value.find(n => n.id === id);
  if (notification && notification.duration && notification.duration > 0) {
    // 标记为未暂停状态
    notification.paused = false;

    // 重新设置定时器
    const timer = setTimeout(() => {
      removeNotification(notification.id);
    }, notification.duration);
    timers.set(notification.id, timer);
  }
};

/**
 * 处理队列
 */
const processQueue = () => {
  if (queue.value.length > 0 && notifications.value.length < MAX_NOTIFICATIONS) {
    const nextNotification = queue.value.shift();
    if (nextNotification) {
      notifications.value.unshift(nextNotification);

      // 设置自动关闭定时器
      if (nextNotification.duration && nextNotification.duration > 0) {
        const timer = setTimeout(() => {
          removeNotification(nextNotification.id);
        }, nextNotification.duration);
        timers.set(nextNotification.id, timer);
      }
    }
  }
};

/**
 * 清除所有通知
 */
const clearAll = () => {
  // 清除所有定时器
  timers.forEach(timer => clearTimeout(timer));
  timers.clear();

  // 清空列表和队列
  notifications.value = [];
  queue.value = [];
};

// ==================== 便捷方法 ====================

/**
 * 显示信息通知
 */
const showInfo = (title: string, message?: string, duration?: number) => {
  return addNotification('info', title, message, { duration });
};

/**
 * 显示警告通知
 */
const showWarning = (title: string, message?: string, duration?: number) => {
  return addNotification('warning', title, message, { duration });
};

/**
 * 显示错误通知
 */
const showError = (title: string, message?: string, duration?: number) => {
  return addNotification('error', title, message, { duration });
};

/**
 * 显示成功通知
 */
const showSuccess = (title: string, message?: string, duration?: number) => {
  return addNotification('success', title, message, { duration });
};

// ==================== 计算属性 ====================

/**
 * 通知数量
 */
const notificationCount = computed(() => notifications.value.length);

// ==================== 导出 ====================

/**
 * 通知管理 Composable
 *
 * 返回全局单例的通知服务
 */
export function useNotifications() {
  return {
    // 状态
    notifications,
    queue,
    notificationCount,

    // 方法
    addNotification,
    removeNotification,
    pauseNotification,
    resumeNotification,
    clearAll,
    showInfo,
    showWarning,
    showError,
    showSuccess,
  };
}