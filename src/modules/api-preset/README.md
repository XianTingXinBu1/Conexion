# API 预设模块

API 预设模块负责管理 OpenAI 兼容上游接口配置，包括 base URL、API Key、模型和生成参数。

当前项目的真实请求链路是：

```txt
ApiPresetPage / useApiPresets
  -> src/api/models.ts / src/api/chat.ts
    -> 本地 /api 代理
      -> server/index.ts
        -> 上游 OpenAI-compatible API
```

因此 API 预设保存的是“上游配置”，请求会通过内建后端代理转发，不再维护旧版 query/header proxy 配置。

## 功能特性

- 预设 CRUD：创建、读取、更新、删除、重命名。
- 当前预设选择：保存并恢复选中的预设 ID。
- 表单适配：将预设数据映射为页面表单数据。
- 模型配置：保存模型名、stream 开关、temperature、上下文和输出 token 参数。
- 内建后端状态：页面表单会检查 `/api/health`。
- 持久化存储：通过 `apiPresetRepository` 读写本地存储。

## 主要文件

```txt
src/modules/api-preset/
├── index.ts
├── types.ts
├── useApiPresets.ts
├── components/
│   ├── ApiConfigForm.vue
│   ├── ModelSelector.vue
│   ├── ParameterSettings.vue
│   └── PresetSelector.vue
└── README.md
```

相关文件：

```txt
src/components/ApiPresetPage.vue
src/repositories/apiPresetRepository.ts
src/api/models.ts
src/api/chat.ts
server/index.ts
```

## API

### useApiPresets

```typescript
import { useApiPresets } from '@/modules/api-preset'

const {
  presets,
  selectedPreset,
  currentPreset,
  showNewPresetDialog,
  showRenameDialog,
  newPresetName,
  renamePresetName,
  canCreatePreset,
  canRenamePreset,
  confirmDialogProps,
  ConfirmDialog,

  loadPresets,
  loadSelectedPreset,
  selectPreset,
  saveCurrentPreset,
  createNewPreset,
  deletePreset,
  handleConfirmDelete,
  openRenameDialog,
  renamePreset,
  openCreateNewDialog,
  loadPresetToForm,
  createDefaultPresetFormData,
  cancelDelete,
  onPresetChange,
} = useApiPresets()
```

常用操作：

```typescript
await loadPresets()
await loadSelectedPreset()

await selectPreset('default')

await saveCurrentPreset({
  url: 'https://api.openai.com/v1',
  apiKey: 'sk-xxx',
  model: 'gpt-4o-mini',
  streamEnabled: true,
  temperature: 0.7,
  maxTokens: 8192,
  maxOutputTokens: 2048,
})

openCreateNewDialog()
await createNewPreset()

deletePreset('preset-id')
await handleConfirmDelete()
```

## 类型

```typescript
interface ApiConfig {
  url: string;
  apiKey: string;
  model: string;
  streamEnabled: boolean;
  temperature: number;
  maxTokens: number;
  maxOutputTokens: number;
}

interface Preset {
  id: string;
  name: string;
  url: string;
  apiKey: string;
  model: string;
  streamEnabled: boolean;
  temperature: number;
  maxTokens: number;
  maxOutputTokens: number;
  createdAt: number;
  updatedAt: number;
}

interface PresetFormData {
  url: string;
  apiKey: string;
  model: string;
  streamEnabled: boolean;
  temperature: number;
  maxTokens: number;
  maxOutputTokens: number;
}
```

## 组件

### ApiConfigForm

API 配置表单组件。

职责：

- 编辑上游 URL。
- 编辑 API Key。
- 检查内建后端 `/api/health` 状态。
- 校验 URL 格式。

### ModelSelector

模型选择器组件。

职责：

- 展示模型列表。
- 支持手动输入模型名。
- 触发模型加载。
- 触发连接测试。

### ParameterSettings

参数设置组件。

职责：

- stream 开关。
- temperature。
- maxTokens。
- maxOutputTokens。

### PresetSelector

预设选择器组件。

职责：

- 切换预设。
- 创建预设。
- 重命名预设。
- 删除预设。

## 后端代理接口

API 预设相关页面会间接使用这些后端接口：

```txt
GET  /api/health
GET  /api/models
POST /api/models
POST /api/connection-test
POST /api/chat/completions
```

注意：

- `baseURL` 会由后端校验，只允许 `http` / `https`。
- 默认在后端绑定本机时允许本机 / 内网上游。
- 如果后端绑定公网地址，默认禁止本机 / 内网上游。
- 如确有需要，可通过 `ALLOW_PRIVATE_UPSTREAMS=true` 显式允许。

## 开发注意事项

- 不要恢复旧版 `proxy` 字段；当前类型中没有 `proxy`。
- API Key 不应写死在代码中。
- 页面不应直接读写 storage key，统一走 repository / composable。
- 连接测试和模型加载应通过内建 `/api` 代理执行。

## 验证建议

修改 API 预设模块后建议运行：

```bash
npm run test:run
npm run build
```

如果涉及聊天发送或后端代理，再运行：

```bash
npm run health-check
```
