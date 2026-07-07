# 调试系统模块

调试系统模块提供分类日志、日志历史和调试开关，主要用于开发期观察 API、Prompt、会话等内部流程。

## 功能特性

- 分类日志：`API`、`PRESET`、`PROMPT`、`CONVERSATION`、`SYSTEM`、`GENERAL`
- 日志级别：`log`、`warn`、`error`、`info`
- 历史记录：最多保留 100 条日志
- 分组显示：支持展开 / 折叠复杂对象
- 调试模式：全局开关，关闭时不记录日志
- 便捷分类方法：如 `logApi`、`logPrompt`、`logConversationInfo`

## 主要文件

```txt
src/modules/debug/
├── index.ts
├── logger.ts
├── categories.ts
├── types.ts
└── README.md
```

## 模块入口

```typescript
import {
  setDebugMode,
  getDebugMode,
  log,
  logGroup,
  logGroupCollapsed,
  getLogHistory,
  clearLogHistory,
  exportLogHistory,
  showDebugHelp,
  logApi,
  logApiWarn,
  logApiError,
  logPrompt,
  logPromptWarn,
  logConversation,
  logConversationInfo,
  logSystem,
  logSystemWarn,
  logSystemError,
} from '@/modules/debug'
```

也可以直接使用：

```typescript
import { useDebugLogger } from '@/composables/useDebugLogger'
```

## 基本用法

```typescript
import { setDebugMode, logApi, logApiError } from '@/modules/debug'

setDebugMode(true)

logApi('请求发送', { url: '/api/models' })

try {
  // ...
} catch (error) {
  logApiError('请求失败', error)
}
```

## Logger API

```typescript
setDebugMode(true)

log('log', 'API', 'API 请求发送', { url: 'https://api.example.com' })
log('error', 'API', '请求失败', error)

logGroup('PRESET', '当前预设', preset)
logGroupCollapsed('API', 'API 响应', response)

const history = getLogHistory()
clearLogHistory()
exportLogHistory()
showDebugHelp()
```

## useDebugLogger

```typescript
import { useDebugLogger } from '@/composables/useDebugLogger'

const {
  debugMode,
  logHistory,
  logApi,
  logApiWarn,
  logApiError,
  logPreset,
  logPresetWarn,
  logCurrentPreset,
  logPrompt,
  logPromptWarn,
  logSystemPrompt,
  logKnowledgeBase,
  logConversation,
  logConversationInfo,
  logSystem,
  logSystemWarn,
  logSystemError,
  clearLogHistory,
  exportLogHistory,
  showDebugHelp,
} = useDebugLogger()
```

## 分类

| 分类 | 图标 | 用途 |
|------|------|------|
| API | 🔌 | API 请求和响应 |
| PRESET | ⚙️ | 预设管理 |
| PROMPT | 📝 | 提示词构建 |
| CONVERSATION | 💬 | 会话管理 |
| SYSTEM | ⚙️ | 系统事件 |
| GENERAL | ℹ️ | 通用日志 |

## 日志级别

| 级别 | 用途 |
|------|------|
| log | 普通日志 |
| warn | 警告 |
| error | 错误 |
| info | 信息 |

## 类型

```typescript
type DebugLevel = 'log' | 'warn' | 'error' | 'info'
type DebugCategory = 'API' | 'PRESET' | 'PROMPT' | 'CONVERSATION' | 'SYSTEM' | 'GENERAL'

interface DebugLogItem {
  timestamp: number;
  level: DebugLevel;
  category: DebugCategory;
  message: string;
  data?: unknown;
}
```

## 适用场景

- API 请求 / 响应排查
- Prompt 构建排查
- 会话保存和加载排查
- 设置和预设切换排查
- 开发期临时观察内部状态

## 注意事项

- 调试日志面向开发期，不应作为用户可见错误提示。
- 不要在日志中主动打印完整 API Key。
- 生产环境若关闭 debug mode，日志不会记录。
