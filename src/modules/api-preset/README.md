# API 预设模块

提供 API 预设的 CRUD 管理功能，支持模型配置和代理设置。

## 功能特性

- **CRUD 操作**：创建、读取、更新、删除预设
- **模型管理**：支持模型列表管理和参数配置
- **代理支持**：支持 query 和 header 两种代理类型
- **持久化存储**：自动保存到 IndexedDB

## API

### useApiPresets

```typescript
import { useApiPresets } from '@/modules/api-preset'

const {
  presets,              // 预设列表
  selectedPreset,       // 选中的预设 ID
  currentPreset,        // 当前预设对象
  showNewPresetDialog,  // 显示新建对话框
  showRenameDialog,     // 显示重命名对话框
  ConfirmDialog,        // 确认对话框组件
  // 方法
  loadPresets,          // 加载预设
  loadSelectedPreset,   // 加载选中的预设
  selectPreset,         // 选择预设
  saveCurrentPreset,    // 保存当前预设
  createNewPreset,      // 创建新预设
  deletePreset,         // 删除预设
  openRenameDialog,     // 打开重命名对话框
  renamePreset,         // 重命名预设
  loadPresetToForm,     // 加载预设到表单
  onPresetChange,       // 监听预设变化
} = useApiPresets()

// 保存当前预设
saveCurrentPreset({
  url: 'https://api.openai.com/v1',
  apiKey: 'sk-xxx',
  model: 'gpt-4',
  streamEnabled: true,
  temperature: 0.7,
  maxTokens: 2048,
  maxOutputTokens: 4096,
  proxy: {
    enabled: false,
    url: '',
    type: 'query',
    targetEndpoint: '',
  },
})

// 创建新预设
openCreateNewDialog()
createNewPreset(formData)

// 删除预设
deletePreset('preset-id')

// 监听预设变化
onPresetChange((preset) => {
  console.log('预设已切换:', preset)
})
```

## 类型

```typescript
type ProxyType = 'query' | 'header'

interface ProxyConfig {
  enabled: boolean;
  url: string;
  type: ProxyType;
  targetEndpoint?: string;
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
  proxy: ProxyConfig;
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
  proxy: ProxyConfig;
}
```

## 组件

### ApiConfigForm

API 配置表单组件，用于编辑预设配置。

### ModelSelector

模型选择器组件，用于选择和配置模型。

### PresetSelector

预设选择器组件，用于选择预设。

## 使用示例

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { useApiPresets } from '@/modules/api-preset'

const {
  presets,
  selectedPreset,
  selectPreset,
  saveCurrentPreset,
} = useApiPresets()

const formData = ref({
  url: '',
  apiKey: '',
  model: '',
  streamEnabled: true,
  temperature: 0.7,
  maxTokens: 2048,
  maxOutputTokens: 4096,
  proxy: {
    enabled: false,
    url: '',
    type: 'query',
    targetEndpoint: '',
  },
})

function handleSave() {
  saveCurrentPreset(formData.value)
}
</script>

<template>
  <select v-model="selectedPreset" @change="selectPreset(selectedPreset)">
    <option v-for="p in presets" :key="p.id" :value="p.id">
      {{ p.name }}
    </option>
  </select>
  <button @click="handleSave">保存</button>
</template>
```