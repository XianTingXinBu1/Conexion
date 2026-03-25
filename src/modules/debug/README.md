# 调试系统模块

提供调试日志记录和分类管理功能。

## 功能特性

- **分类日志**：API、PRESET、PROMPT、CONVERSATION、SYSTEM、GENERAL
- **日志级别**：log、warn、error、info
- **历史记录**：最多保留 100 条日志
- **分组显示**：支持展开/折叠分组显示复杂对象
- **调试模式**：全局开关，关闭时不记录日志

## API

### Logger 模块

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
} from '@/modules/debug/logger'

// 设置调试模式
setDebugMode(true)

// 记录日志
log('log', 'API', 'API 请求发送', { url: 'https://api.example.com' })
log('error', 'API', '请求失败', error)

// 分组显示
logGroup('PRESET', '当前预设', preset)
logGroupCollapsed('API', 'API 响应', response)

// 获取日志历史
const history = getLogHistory()

// 清空日志
clearLogHistory()

// 导出日志
exportLogHistory()

// 显示帮助
showDebugHelp()
```

### useDebugLogger Composable

```typescript
import { useDebugLogger } from '@/composables/useDebugLogger'

const {
  debugMode,
  logHistory,
  logApi,           // API 日志
  logApiWarn,       // API 警告
  logApiError,      // API 错误
  logPreset,        // 预设日志
  logPresetWarn,    // 预设警告
  logCurrentPreset, // 当前预设
  logPrompt,        // 提示词日志
  logPromptWarn,    // 提示词警告
  logSystemPrompt,  // 系统提示词
  logKnowledgeBase, // 知识库
  logConversation,  // 会话日志
  logConversationInfo, // 会话信息
  logSystem,        // 系统日志
  logSystemWarn,    // 系统警告
  logSystemError,   // 系统错误
  clearLogHistory,
  exportLogHistory,
  showDebugHelp,
} = useDebugLogger()

// 使用便捷方法
logApi('请求发送', { url, method })
logApiError('请求失败', error)
logCurrentPreset(preset)
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

| 级别 | 颜色 | 用途 |
|------|------|------|
| log | indigo-500 | 普通日志 |
| warn | amber-500 | 警告 |
| error | red-500 | 错误 |
| info | blue-500 | 信息 |

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

## 配置

```typescript
const MAX_LOG_HISTORY = 100  // 最大日志数量
```

## 使用示例

```vue
<script setup lang="ts">
import { useDebugLogger } from '@/composables/useDebugLogger'
import { onMounted } from 'vue'

const { logApi, logApiError, debugMode } = useDebugLogger()

async function fetchData() {
  logApi('开始请求数据')
  try {
    const response = await fetch('https://api.example.com')
    logApi('请求成功', { status: response.status })
  } catch (error) {
    logApiError('请求失败', error)
  }
}

onMounted(() => {
  if (debugMode.value) {
    console.log('调试模式已启用')
  }
})
</script>
```
