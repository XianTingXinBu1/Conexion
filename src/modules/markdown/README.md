# Markdown 渲染模块

提供安全的 Markdown 渲染功能，支持 XSS 防护和自定义代码块渲染。

## 功能特性

- **XSS 防护**：使用 DOMPurify 进行 HTML 清理
- **代码块渲染**：内置代码块容器、复制按钮等交互，不依赖 highlight.js
- **自定义渲染**：支持渲染钩子（beforeRender/afterRender）
- **全局配置**：支持全局配置和运行时配置

## API

### useMarkdown

```typescript
import { useMarkdown } from '@/modules/markdown'

const { renderSafe, render, reconfigure, reset } = useMarkdown({
  gfm: true,           // 启用 GitHub Flavored Markdown
  breaks: true,        // 将换行符转换为 <br>
  sanitizer: {         // XSS 防护配置
    enabled: true,
    allowedTags: ['p', 'code', 'pre', 'a', 'img'],
  },
  hooks: {             // 自定义渲染钩子
    beforeRender: (content) => content,
    afterRender: (html) => html,
  },
})

// 渲染并清理（推荐）
const html = renderSafe(markdownContent)

// 仅渲染（不清理）
const html = render(markdownContent)

// 重新配置
await reconfigure({ gfm: false })

// 重置为默认配置
reset()
```

### MarkdownRenderer 组件

```vue
<template>
  <MarkdownRenderer
    :content="markdownContent"
    :enabled="true"
    :config="{ gfm: true }"
    class="custom-class"
  />
</template>

<script setup>
import { MarkdownRenderer } from '@/modules/markdown/components'
</script>
```

## 全局配置

```typescript
import { setGlobalMarkdownConfig, getGlobalMarkdownConfig } from '@/modules/markdown'

// 设置全局配置
await setGlobalMarkdownConfig({
  gfm: true,
  breaks: true,
  sanitizer: { enabled: true },
})

// 获取全局配置
const config = getGlobalMarkdownConfig()
```

## 默认配置

- `gfm`: true（启用 GitHub Flavored Markdown）
- `breaks`: true（将换行符转换为 <br>）
- `sanitizer.enabled`: true（启用 XSS 防护）

## 类型

```typescript
interface MarkdownConfig {
  gfm?: boolean;
  breaks?: boolean;
  sanitizer?: Partial<SanitizerConfig>;
  hooks?: MarkdownHooks;
}

interface UseMarkdownReturn {
  render: (content: string) => string;
  renderSafe: (content: string) => string;
  reconfigure: (config: Partial<MarkdownConfig>) => Promise<void>;
  reset: () => void;
  config: ResolvedMarkdownConfig;
  isReady: () => boolean;
}
```

## 使用示例

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { useMarkdown } from '@/modules/markdown'
import { MarkdownRenderer } from '@/modules/markdown/components'

const content = ref('# Hello\n\n```javascript\nconsole.log("Hello");\n```')
const { renderSafe } = useMarkdown()
</script>

<template>
  <div v-html="renderSafe(content)" />
  <MarkdownRenderer :content="content" />
</template>
```
