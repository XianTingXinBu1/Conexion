# Markdown 渲染模块

Markdown 模块提供安全的 Markdown 渲染能力，用于聊天消息、通知内容等场景。

底层使用：

- `marked`：Markdown 解析
- `DOMPurify`：HTML 清理 / XSS 防护

## 功能特性

- GFM 支持。
- 换行转 `<br>`。
- XSS 防护。
- 自定义代码块渲染。
- 链接自动加 `target="_blank"` 和 `rel="noopener noreferrer"`。
- 图片 lazy loading。
- 渲染前 / 渲染后 hooks。
- 全局配置和运行时配置。
- `MarkdownRenderer` 组件支持高频流式更新标记。

## 主要文件

```txt
src/modules/markdown/
├── index.ts
├── useMarkdown.ts
├── config.ts
├── sanitizer.ts
├── types.ts
├── markdown.test.ts
├── components/
│   ├── MarkdownRenderer.vue
│   └── CodeBlock.vue
├── styles/
└── README.md
```

## useMarkdown

```typescript
import { useMarkdown } from '@/modules/markdown'

const { renderSafe, render, reconfigure, reset, config, isReady } = useMarkdown({
  gfm: true,
  breaks: true,
  sanitizer: {
    enabled: true,
    allowedTags: ['p', 'code', 'pre', 'a', 'img'],
  },
  hooks: {
    beforeRender: (content) => content,
    afterRender: (html) => html,
  },
})

const safeHtml = renderSafe(markdownContent)
const rawHtml = render(markdownContent)

await reconfigure({ gfm: false })
reset()
```

推荐使用 `renderSafe`，除非调用方明确知道自己在处理可信 HTML。

## MarkdownRenderer 组件

```vue
<template>
  <MarkdownRenderer
    :content="markdownContent"
    :enabled="true"
    :streaming="false"
    :config="{ gfm: true }"
    class="custom-class"
  />
</template>

<script setup lang="ts">
import { MarkdownRenderer } from '@/modules/markdown'
</script>
```

Props：

```typescript
interface MarkdownRendererProps {
  content: string;
  enabled?: boolean;
  streaming?: boolean;
  config?: Partial<MarkdownConfig>;
  class?: string;
}
```

说明：

- `enabled=false` 时直接显示原文。
- `streaming=true` 可用于标记内容正在高频更新。
- `config` 会覆盖默认渲染配置。

## 全局配置

```typescript
import { setGlobalMarkdownConfig, getGlobalMarkdownConfig } from '@/modules/markdown'

await setGlobalMarkdownConfig({
  gfm: true,
  breaks: true,
  sanitizer: { enabled: true },
})

const config = getGlobalMarkdownConfig()
```

## 默认配置

默认配置位于：

```txt
src/modules/markdown/config.ts
```

默认行为：

- `gfm: true`
- `breaks: true`
- `sanitizer.enabled: true`

## 类型

```typescript
interface SanitizerConfig {
  enabled: boolean;
  allowedTags?: string[];
  allowedAttributes?: Record<string, string[]>;
}

interface MarkdownHooks {
  beforeRender?: (content: string) => string;
  afterRender?: (html: string) => string;
}

interface MarkdownConfig {
  gfm?: boolean;
  breaks?: boolean;
  sanitizer?: Partial<SanitizerConfig>;
  hooks?: MarkdownHooks;
}

interface UseMarkdownReturn {
  render: (content: string) => string;
  renderSafe: (content: string) => string;
  reconfigure: (newConfig: Partial<MarkdownConfig>) => Promise<void>;
  reset: () => void;
  config: ResolvedMarkdownConfig;
  isReady: () => boolean;
}
```

## 使用示例

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { MarkdownRenderer, useMarkdown } from '@/modules/markdown'

const content = ref('# Hello\n\n```javascript\nconsole.log("Hello")\n```')
const { renderSafe } = useMarkdown()
</script>

<template>
  <div v-html="renderSafe(content)" />
  <MarkdownRenderer :content="content" />
</template>
```

## 注意事项

- 默认不依赖 highlight.js。
- 渲染出来的 HTML 应使用模块提供的 sanitizer。
- 需要直接 `v-html` 时优先使用 `renderSafe`。
- 不要把未经清理的用户输入直接写入 DOM。

## 验证建议

修改 Markdown 模块后运行：

```bash
npm run test:run
npm run build
```
