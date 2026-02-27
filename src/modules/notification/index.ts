/**
 * 通知系统模块
 *
 * 提供统一的通知管理功能
 */

// 类型定义
export type { NotificationType, NotificationItem } from './types';

// Composable
export { useNotifications } from './useNotifications';

// 组件
export { NotificationContainer, NotificationToast } from './components';

// 消息配置
export { getNotificationMessage } from './messages';

// 样式
import './styles/notification.css';