# Markdown 渲染模块

Markdown 模块提供安全的 Markdown 渲染能力，用于聊天消息、通知内容等场景。

底层使用：

- `marked`：Markdown 解析
- `DOMPurify`：HTML 清理 / XSS 防护

## 功能特性

- GFM 支持。
- 换行转 `<br>`。
- XSS 防护：标签白名单 + 按标签维度的属性白名单（per-tag）；任务列表复选框只保留
  不可交互的 `disabled` checkbox，其余 `input`（text / file / submit …）整节点移除。
- 自定义代码块 / 行内代码渲染（内容转义，不会当作 HTML 解析）。
- 链接文本内的行内 markdown（加粗 / 行内代码 / 图片）会被正常渲染。
- 链接自动加 `target="_blank"` 和 `rel="noopener noreferrer"`。
- 图片 lazy loading。
- 数学公式：`$...$`（行内）、`$$...$$`（块级），并兼容 `\(...\)` / `\[...\]`，由 KaTeX 渲染。
- 支持 `<details>/<summary>` 折叠块，以及 `kbd` / `mark` / `sub` / `sup` / `abbr` / `ins` 等内联语义标签。
- 脚注：`[^1]` 引用 + `[^1]: 内容` 定义，渲染为上标标记与文末列表（marked 原生不支持，见「注意事项」）。
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
├── math.ts
├── footnote.ts
├── segments.ts
├── types.ts
├── markdown.test.ts
├── math.test.ts
├── footnote.test.ts
├── components/
│   └── MarkdownRenderer.vue
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

- 覆盖 marked 的 renderer 回调时注意：新版统一接收 token 对象（如 `codespan({ text })`），
  且必须自行转义文本——否则行内代码会渲染成 `[object Object]` 或被当作 HTML。
- `link` / `image` 的 `token.text` 是「未解析的原始文本」：链接文本内的 markdown 必须用
  `this.parser.parseInline(token.tokens)` 渲染（图片 alt 用 `this.parser.textRenderer`
  摊平成纯文本），否则会原样输出 `**加粗**` / `` `代码` ``。这两个回调必须写成
  `function`，箭头函数拿不到 marked 注入的 `this.parser`。
- `DEFAULT_ALLOWED_ATTRIBUTES` 是 per-tag 结构，由 sanitizer 钩子在过滤后收紧；
  DOMPurify 的 `ALLOWED_ATTR` 是全局列表，只作为粗过滤。新标签默认不带任何属性，
  靠 class 定位的样式（如代码块的 `.code-wrapper`）需要在映射里显式声明。
- **数学公式不走 sanitizer**：KaTeX 输出依赖大量 inline style 做竖排定位，
  进白名单会被删干净导致排版崩。实现是「占位符 + 回填」（`math.ts`）：
  渲染前抽成纯文本占位符 → marked → sanitize → 再换回 KaTeX HTML。
  因此 KaTeX 的 CSS 需要在入口（`src/main.ts`）引入，且 KaTeX 以 `trust: false`
  运行（`\href` / `\htmlClass` 等命令不生成 HTML），公式文本均经过转义。
- 代码块与行内代码内的 `$` 不会被当作公式；`$5 和 $10` 这类货币写法也不会误判。
- **脚注**由 `footnote.ts` 预处理：marked 不支持 GFM 脚注，会把 `[^1]: 内容`
  当成引用式链接定义，渲染出 `href="内容"` 的错误链接（点进去 404）。实现是移
  除定义行 → 把引用换成 `<sup class="footnote-ref">[n]</sup>` → 文末追加
  `<div class="footnotes">` + 有序列表（仍是 Markdown 文本，脚注内容照常走解析
  与清洗）。刻意**不引入锚点 id / `href="#fn-1"`**，既不为 `id` 放宽白名单，
  也避开多条消息共用容器时的 id 冲突。
- 公式与脚注的预处理统一走 `segments.ts`（按 fenced code block + 行内代码切分），
  代码里的 `$...$` / `[^1]` 不会被改写。
- 默认不依赖 highlight.js。
- 渲染出来的 HTML 应使用模块提供的 sanitizer。
- 需要直接 `v-html` 时优先使用 `renderSafe`。
- 不要把未经清理的用户输入直接写入 DOM。

## 验证建议

修改 Markdown 模块后运行：

```bash
node scripts/health-check/health-check.js
```

DOM 级行为（如属性白名单、危险协议拦截）在 happy-dom 下不可信
（DOMPurify 在该环境无法正确解析标签），已由 `e2e/cases/markdown-render.mjs`
在真实 Chromium 中覆盖：

```bash
node e2e/run.mjs markdown     # 只跑 markdown 用例
```
