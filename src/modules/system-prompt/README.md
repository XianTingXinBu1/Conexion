# 系统提示词构建模块

系统提示词构建模块负责把 Prompt 预设、角色、用户设定、知识库、聊天历史、用户当前输入和压缩摘要组合成 OpenAI Chat API 格式的 `messages` 数组。

它是聊天真实发送和 Prompt 预览的底层构建能力。

## 功能特性

- 根据 Prompt 预设动态构建 `messages`。
- 自动填充特殊条目：角色设定、用户设定、知识库、聊天历史、用户指令。
- 支持会话压缩摘要注入。
- 支持 `insertPosition` 排序。
- 支持 `system` / `user` / `assistant` 三种角色类型。
- 支持消息合并：`none` / `adjacent` / `all`。
- 提供粗略 token 估算。
- 返回构建元数据，方便 Prompt 预览和调试。

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
│   └── builder.test.ts
├── README.md
├── USAGE.md
└── SUMMARY.md
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

以下条目名称会被自动识别并填充内容：

| 条目名称 | 占位符类型 | 数据来源 | 描述 |
|---------|-----------|---------|------|
| 角色设定 | `character` | `aiCharacter` | AI 角色的人设和性格 |
| 用户设定 | `user` | `userCharacter` | 用户身份信息 |
| 知识库 | `knowledge` | `knowledgeBases` | 全局启用知识库中的已启用条目 |
| 聊天历史 | `chat-history` | `chatHistory` | 对话历史记录 |
| 用户指令 | `user-instruction` | `userInstruction` | 当前用户输入 |

此外，`compressionSummary` 会在构建开始时作为 system message 注入。

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
2. 如存在 `compressionSummary`，先注入 system message。
3. 按 `insertPosition` 对预设条目排序。
4. 跳过未启用条目。
5. 对特殊条目执行内容填充。
6. 将聊天历史和用户指令转换为独立 message。
7. 根据配置过滤空内容。
8. 按 `mergeMode` 合并消息。
9. 估算 token。
10. 返回 messages、使用条目、跳过条目和元数据。

## 在聊天模块中的位置

聊天模块不应在页面中直接调用底层 builder。

当前推荐链路：

```txt
ChatPage.vue
  -> useChatPageViewModel
    -> useChatPromptController / useChatSendFlow
      -> buildSystemMessagesUseCase
        -> buildSystemPrompt
```

相关文件：

```txt
src/modules/chat-prompt/application/buildChatSystemMessages.usecase.ts
src/modules/chat-prompt/presentation/useChatPromptBuilder.ts
src/features/chat/presentation/useChatPromptController.ts
```

## 设计原则

1. 类型安全：所有输入输出都有 TypeScript 类型。
2. 可测试：核心构建逻辑不依赖 Vue 和 DOM。
3. 单一职责：只负责构建 messages，不负责请求 API。
4. 可解释：返回 metadata 供 UI 展示和调试。
5. 可扩展：可继续增加特殊占位符和合并策略。

## 注意事项

- token 估算是粗略估算，不等于真实模型 tokenizer 结果。
- 知识库只收集全局启用知识库中的已启用条目。
- 聊天历史条目会拆为多个 message，并保留 user / assistant 角色。
- `insertPosition` 数字越小越靠前，缺省值靠后。
- 未启用或空内容条目会进入 `skippedItemIds`。
- 不要在页面层直接拼接 system prompt。

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
