# 系统提示词构建模块

系统提示词构建模块负责把 Prompt 预设、角色、用户设定、知识库、聊天历史、用户当前输入和压缩摘要组合成 OpenAI Chat API 格式的 `messages` 数组。

它现在是聊天**真实发送 / Prompt 预览 / 上下文统计**共用的底层构建能力。

## 功能特性

- 根据 Prompt 预设动态构建最终 `ChatMessage[]`。
- 自动填充特殊条目：角色设定、用户设定、知识库、压缩摘要、聊天历史、用户指令。
- 支持会话压缩摘要注入。
- 支持 `insertPosition` 排序。
- 支持 `system` / `user` / `assistant` 三种角色类型。
- 支持消息合并：`none` / `adjacent` / `all`。
- token 计数复用聊天侧同一个 gpt-tokenizer（`@/utils/tokenCounter`），与上下文用量同口径。
- 返回构建元数据，方便 Prompt 预览和调试。
- 对缺少 `compression-summary` 条目的旧预设保留兼容行为。

## 目录结构

```txt
src/modules/system-prompt/
├── index.ts
├── types.ts
├── core/
│   ├── index.ts
│   ├── builder.ts
│   ├── content-filler.ts
│   └── merger.ts
├── utils/
│   ├── index.ts
│   └── constants.ts
├── __tests__/
│   ├── builder.test.ts
│   ├── macro.test.ts
│   └── merger.test.ts
├── README.md
└── USAGE.md
```

## 快速开始

```typescript
import { buildSystemPrompt } from '@/modules/system-prompt'

const result = buildSystemPrompt({
  preset: promptPreset,
  aiCharacter,
  userCharacter,
  knowledgeBases,
  chatHistory: messages,
  userInstruction: userInput,
  compressionSummary,
  mergeMode: 'adjacent',
  filterEmptyPrompts: true,
})

console.log(result.messages)
console.log(result.estimatedTokens)
console.log(result.metadata)
```

## 特殊条目自动填充

以下条目名称或内置条目 ID 会被自动识别并填充内容：

| 条目名称 / ID | 占位符类型 | 数据来源 | 描述 |
|---------|-----------|---------|------|
| 角色设定 / `character-setting` | `character` | `aiCharacter` | AI 角色的人设和性格 |
| 用户设定 / `user-setting` | `user` | `userCharacter` | 用户身份信息 |
| 知识库 / `knowledge-base` | `knowledge` | `knowledgeBases` | 全局启用或当前角色绑定的知识库中的已启用条目 |
| 压缩摘要 / `compression-summary` | `compression-summary` | `compressionSummary` | 已压缩历史上下文摘要 |
| 聊天历史 / `chat-history` | `chat-history` | `chatHistory` | 对话历史记录 |
| 用户指令 / `user-instruction` | `user-instruction` | `userInstruction` | 当前用户输入 |

兼容说明：

- 如果预设里已经包含 `compression-summary` 条目，则压缩摘要会在该条目的插入位置进入结果。
- 如果旧预设里没有该条目，但调用方传了 `compressionSummary`，模块会保留旧行为，默认把它前置注入为一条 `system` message。

## 宏（变量）替换

自定义提示词内容（例如“角色设定”以外的普通条目、或给特殊条目手写的内容）会执行 `{{...}}` 宏替换。
特殊条目没有自定义内容时，内置模板本身会执行宏替换，但**注入进去的运行时数据不会**。

| 变量 | 含义 |
|------|------|
| `{{char}}` / `{{charname}}` | AI 角色名 |
| `{{user}}` / `{{username}}` | 用户角色名 |
| `{{description}}` | AI 角色描述 |
| `{{personality}}` | AI 角色性格 |
| `{{user_description}}` | 用户描述 |
| `{{time}}` | 实时日期时间 `YYYY-MM-DD HH:mm:ss` |
| `{{date}}` | 实时日期 `YYYY-MM-DD` |
| `{{weekday}}` | 实时星期（中文，如 `星期三`） |
| `{{hour}}` | 实时小时 `00-23` |

规则：

- 变量名不区分大小写，允许 `{{ name }}` 带空格。
- 未识别的变量保持原样，不会报错。
- 角色为空时对应变量替换为空字符串。
- 时间变量基于构建时刻，可通过 `buildSystemPrompt({ now })` 注入固定时间便于测试。

作用域（重要）：

- 宏只展开**作者写的提示词文本**：条目自定义 `prompt`、内置模板自身。
- 通过槽位注入的**运行时数据一律按原样写入，不参与宏展开**：角色 `description` / `personality`、
  知识库正文、压缩摘要，以及聊天历史与用户输入。
- 因此角色描述里写的字面量 `{{user}}` 不会被替换，知识库正文也不会被误改。
- 变量清单的单一真源是 `src/modules/system-prompt/core/macro.ts` 的 `MACRO_DEFINITIONS`：
  运行时取值表、`SUPPORTED_MACROS` 与表单变量 chips（`PROMPT_MACRO_HINTS`）全部由它派生，
  别名（`charname` / `username`）不单独展示 chip 但仍可用。

本模块之外还有一处展开：聊天内容（用户输入 / AI 输出）由
`src/features/chat/application/chatContentPipeline.ts` 展开宏，并跳过代码块与行内代码。
两边共用 `MACRO_DEFINITIONS`，但作用对象不同，改动宏表时两边都会生效。

## API 参考

### buildSystemPrompt(config)

```typescript
function buildSystemPrompt(config: SystemPromptConfig): SystemPromptResult
```

参数：

```typescript
interface SystemPromptConfig {
  preset: PromptPreset;
  aiCharacter?: AICharacter;
  userCharacter?: UserCharacter;
  knowledgeBases?: KnowledgeBase[];
  chatHistory?: Message[];
  userInstruction?: string;
  compressionSummary?: string;
  mergeMode?: MergeMode;
  filterEmptyPrompts?: boolean;
}
```

返回：

```typescript
interface SystemPromptResult {
  messages: ChatMessage[];
  usedItemIds: string[];
  skippedItemIds: string[];
  chatHistoryCount: number;
  userInstructionIncluded: boolean;
  estimatedTokens: number;
  metadata: BuildMetadata;
}
```

### MergeMode

```typescript
type MergeMode = 'none' | 'adjacent' | 'all'
```

| 模式 | 描述 |
|------|------|
| `none` | 不合并 |
| `adjacent` | 合并相邻同类型消息，推荐默认值 |
| `all` | 合并所有消息到一个 system message 中 |

### 工具函数

```typescript
estimateTokens(text: string): number
estimateMessagesTokens(messages: ChatMessage[]): number
normalizeContent(content: string): string
isContentEmpty(content: string): boolean
isValidRoleType(role: string): boolean
mergeMessages(messages: ChatMessage[], mode: MergeMode): MergeResult
```

## 构建流程

1. 读取配置并设置默认值。
2. 按 `insertPosition` 对预设条目排序。
3. 跳过未启用条目。
4. 对特殊条目执行内容填充。
5. 将 `chat-history` 和 `user-instruction` 转换为独立 message。
6. 按需在 `compression-summary` 条目位置注入压缩摘要。
7. 对旧预设执行压缩摘要兼容前置注入。
8. 根据配置过滤空内容。
9. 按 `mergeMode` 合并消息。
10. 估算 token。
11. 返回 messages、使用条目、跳过条目和元数据。

## 在聊天模块中的位置

聊天模块不应在页面中直接调用底层 builder。

当前推荐链路：

```txt
ChatPage.vue
  -> useChatPageViewModel
    -> useChatPromptController / useChatSendFlow / useChatStats
      -> buildChatSystemMessagesUseCase
        -> buildSystemPrompt
```

相关文件：

```txt
src/modules/chat-prompt/application/buildChatSystemMessages.usecase.ts
src/modules/chat-prompt/presentation/useChatPromptBuilder.ts
src/features/chat/presentation/useChatPromptController.ts
src/features/chat/application/sendMessage.usecase.ts
src/features/chat/presentation/useChatStats.ts
```

## 设计原则

1. 类型安全：所有输入输出都有 TypeScript 类型。
2. 可测试：核心构建逻辑不依赖 Vue 和 DOM。
3. 单一职责：只负责构建最终消息数组，不负责请求 API。
4. 可解释：返回 metadata 供 UI 展示和调试。
5. 可扩展：可继续增加特殊占位符和合并策略。
6. 单一真源：发送 / 预览 / 统计尽量共用同一条构建链。

## 注意事项

- token 估算基于 gpt-tokenizer（cl100k），与上游真实分词器可能有细微差异，但不再按字符数线性折算（旧算法对中文会低估 3~4 倍）。
- 知识库收集全局启用或当前角色绑定的知识库中的已启用条目；按知识库 ID 去重，跨库按优先级升序排序（数字越小越靠前，缺省 50），同优先级保留原顺序。
- 聊天历史条目会拆为多个 message，并保留 user / assistant 角色。
- 用户指令条目会把当前输入放到预设指定的位置。
- `insertPosition` 数字越小越靠前，缺省值靠后。
- 未启用或空内容条目会进入 `skippedItemIds`。
- 不要在页面层直接拼接 system prompt 或再次手动拼接历史消息。

## 验证建议

修改本模块后运行：

```bash
npm run test:run
npm run build
```

如果涉及聊天发送链路，再运行：

```bash
npm run check:architecture
```
