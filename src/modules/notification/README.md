# 通知系统模块

提供全局通知管理功能，支持队列管理和自动关闭。

## 功能特性

- **四种类型**：info、warning、error、success
- **队列管理**：最多同时显示 3 条通知
- **自动关闭**：支持自定义持续时间，可暂停/恢复
- **全局单例**：所有组件共享同一个通知状态

## API

### useNotifications

```typescript
import { useNotifications } from '@/modules/notification'

const {
  notifications,       // 当前显示的通知列表
  queue,              // 等待队列
  notificationCount,  // 通知数量
  showInfo,           // 显示信息通知
  showWarning,        // 显示警告通知
  showError,          // 显示错误通知
  showSuccess,        // 显示成功通知
  removeNotification, // 删除通知
  pauseNotification,  // 暂停自动关闭
  resumeNotification, // 恢复自动关闭
  clearAll,           // 清空所有通知
} = useNotifications()

// 显示通知
showInfo('标题', '消息内容', 3000)
showError('错误', '操作失败')

// 高级用法
const id = addNotification('info', '标题', '消息', {
  duration: 5000,
  onClick: () => console.log('clicked'),
  renderMarkdown: true,
})
```

### NotificationContainer 组件

```vue
<template>
  <NotificationContainer />
</template>

<script setup>
import { NotificationContainer } from '@/modules/notification/components'
</script>
```

## 预设消息

```typescript
import { showSuccessPreset, showErrorPreset, showInfoPreset, showWarningPreset } from '@/modules/notification/messages'

// 显示预设消息
showSuccessPreset('api_save', '预设已保存')
showErrorPreset('api_connection_failed', '连接失败')
```

## 配置

```typescript
const MAX_NOTIFICATIONS = 3  // 最大显示数量
const DEFAULT_DURATION = 3000  // 默认持续时间（毫秒）
```

## 类型

```typescript
type NotificationType = 'info' | 'warning' | 'error' | 'success'

interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  duration?: number;
  onClick?: () => void;
  renderMarkdown?: boolean;
  paused?: boolean;
}
```

## 使用示例

```vue
<script setup lang="ts">
import { useNotifications } from '@/modules/notification'

const { showSuccess, showError } = useNotifications()

function handleSave() {
  try {
    // 保存逻辑
    showSuccess('保存成功', '数据已保存')
  } catch (e) {
    showError('保存失败', '请重试')
  }
}
</script>

<template>
  <button @click="handleSave">保存</button>
</template>
```