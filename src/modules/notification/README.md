# 通知系统模块

通知系统模块提供全局通知管理能力，支持队列、自动关闭、暂停 / 恢复、Markdown 消息渲染和预设消息模板。

## 功能特性

- 四种通知类型：`info`、`warning`、`error`、`success`
- 全局单例状态：所有组件共享通知列表
- 队列管理：最多同时显示 3 条通知
- 自动关闭：默认 3000 ms
- 点击暂停 / 恢复自动关闭
- 可选 `onClick` 回调
- 可选 Markdown 渲染
- 集中式预设消息：`getNotificationMessage`

## 主要文件

```txt
src/modules/notification/
├── index.ts
├── types.ts
├── useNotifications.ts
├── messages.ts
├── messages/
│   ├── apiPresetMessages.ts
│   ├── chatMessages.ts
│   ├── commonMessages.ts
│   └── managementMessages.ts
├── components/
│   ├── NotificationContainer.vue
│   └── NotificationToast.vue
├── styles/
└── README.md
```

## useNotifications

```typescript
import { useNotifications } from '@/modules/notification'

const {
  notifications,
  queue,
  notificationCount,
  addNotification,
  removeNotification,
  pauseNotification,
  resumeNotification,
  clearAll,
  showInfo,
  showWarning,
  showError,
  showSuccess,
} = useNotifications()
```

### 快捷通知

```typescript
showInfo('提示', '操作已开始')
showWarning('注意', '配置可能不完整')
showError('错误', '操作失败')
showSuccess('成功', '保存完成')
```

第三个参数是持续时间：

```typescript
showSuccess('保存成功', '数据已保存', 5000)
```

### 高级通知

```typescript
const id = addNotification('info', '标题', '消息内容', {
  duration: 5000,
  onClick: () => console.log('clicked'),
  renderMarkdown: true,
})

removeNotification(id)
```

`duration <= 0` 时不会自动关闭。

## NotificationContainer 组件

应用根组件中挂载一次即可：

```vue
<template>
  <NotificationContainer />
</template>

<script setup lang="ts">
import { NotificationContainer } from '@/modules/notification'
</script>
```

`NotificationContainer` 内部使用 `Teleport to="body"` 渲染通知列表。

## 预设消息

预设消息统一放在：

```txt
src/modules/notification/messages.ts
src/modules/notification/messages/*Messages.ts
```

用法：

```typescript
import { getNotificationMessage, useNotifications } from '@/modules/notification'

const { showSuccess, showError } = useNotifications()

const success = getNotificationMessage('API_PRESET_SAVE_SUCCESS')
showSuccess(success.title, success.message)

const failure = getNotificationMessage('API_PRESET_CONNECTION_FAILED', { error: '连接失败' })
showError(failure.title, failure.message)
```

新增消息时：

1. 在对应 `messages/*Messages.ts` 增加 key 和模板。
2. 确认该 key 被 `NotificationMessageKey` 合并。
3. 调用处使用 `getNotificationMessage(key, params)`。

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

interface NotificationMessage {
  title: string;
  message?: string;
  type: NotificationType;
  duration?: number;
}
```

## 配置常量

当前常量定义在 `useNotifications.ts`：

```typescript
const MAX_NOTIFICATIONS = 3
const DEFAULT_DURATION = 3000
```

## 使用建议

- 业务模块优先使用 `getNotificationMessage`，减少文案散落。
- 错误通知应包含可读错误信息。
- 不要把 notification 当日志系统使用；开发日志应走 `src/modules/debug`。
- Markdown 通知只在确实需要富文本时启用 `renderMarkdown`。

## 验证建议

修改通知模块后运行：

```bash
npm run test:run
npm run build
```
