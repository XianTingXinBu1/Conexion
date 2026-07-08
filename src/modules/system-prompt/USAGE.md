# 系统提示词构建模块使用指南

本文档给出 `src/modules/system-prompt` 的常用用法。

## 基本用法

```typescript
import { buildSystemPrompt } from '@/modules/system-prompt'
import type { SystemPromptConfig } from '@/modules/system-prompt'

const config: SystemPromptConfig = {
  preset: promptPreset,
  aiCharacter,
  userCharacter,
  knowledgeBases,
  chatHistory: messages,
  userInstruction: userInput,
  compressionSummary,
  mergeMode: 'adjacent',
  filterEmptyPrompts: true,
}

const result = buildSystemPrompt(config)

console.log('Messages:', result.messages)
console.log('Estimated Tokens:', result.estimatedTokens)
console.log('Used Items:', result.usedItemIds)
console.log('Skipped Items:', result.skippedItemIds)
console.log('Chat History Count:', result.chatHistoryCount)
console.log('User Instruction Included:', result.userInstructionIncluded)
console.log('Metadata:', result.metadata)
```

## 特殊条目自动填充

以下条目名称或内置条目 ID 会被自动识别并填充内容：

| 条目名称 / ID | 占位符类型 | 数据来源 |
|---------|-----------|---------|
| 角色设定 / `character-setting` | `character` | `aiCharacter` |
| 用户设定 / `user-setting` | `user` | `userCharacter` |
| 知识库 / `knowledge-base` | `knowledge` | `knowledgeBases` |
| 压缩摘要 / `compression-summary` | `compression-summary` | `compressionSummary` |
| 聊天历史 / `chat-history` | `chat-history` | `chatHistory` |
| 用户指令 / `user-instruction` | `user-instruction` | `userInstruction` |

说明：

- `chat-history` 和 `user-instruction` 是结构性占位符，会被转换成独立消息，而不是普通字符串模板。
- `compression-summary` 会优先走正式条目位置；老预设缺少此条目时，会退回兼容前置注入。

## 推荐在聊天模块中的用法

页面层不要直接拼 system prompt，也不要再额外拼接一份聊天历史。

推荐链路：

```txt
ChatPage.vue
  -> useChatPageViewModel
    -> useChatPromptController / useChatSendFlow / useChatStats
      -> buildSystemMessagesUseCase
        -> buildSystemPrompt
```

示例：

```typescript
import { buildSystemMessagesUseCase } from '@/modules/chat-prompt'

const result = buildSystemMessagesUseCase({
  preset,
  aiCharacter,
  userCharacter,
  knowledgeBases,
  chatHistory,
  userInstruction,
  compressionSummary,
  mergeMode: 'adjacent',
})

console.log(result.messages) // 最终 ChatMessage[]
```

如果只是写纯模块测试或工具函数，可以直接使用 `buildSystemPrompt`。

## Token 估算

```typescript
import { estimateTokens, estimateMessagesTokens } from '@/modules/system-prompt'

const tokenCount = estimateTokens('这是一段文本')
const totalTokens = estimateMessagesTokens(messages)
```

注意：token 估算是粗略值，主要用于 UI 提示和相对比较。

## 消息合并

```typescript
import { mergeMessages } from '@/modules/system-prompt'

const result = mergeMessages(messages, 'adjacent')

console.log(result.messages)
console.log(result.mergeCount)
console.log(result.savedMessages)
```

合并模式：

```typescript
type MergeMode = 'none' | 'adjacent' | 'all'
```

建议默认使用 `adjacent`。

## Prompt 预设条目示例

```typescript
const preset = {
  id: 'preset-1',
  name: '默认预设',
  items: [
    {
      id: 'character-setting',
      name: '角色设定',
      description: '',
      enabled: true,
      prompt: '',
      roleType: 'system',
      insertPosition: 1,
    },
    {
      id: 'main',
      name: '主提示词',
      description: '',
      enabled: true,
      prompt: '请用简洁自然的中文回复。',
      roleType: 'system',
      insertPosition: 2,
    },
    {
      id: 'knowledge-base',
      name: '知识库',
      description: '',
      enabled: true,
      prompt: '',
      roleType: 'system',
      insertPosition: 3,
    },
    {
      id: 'compression-summary',
      name: '压缩摘要',
      description: '',
      enabled: true,
      prompt: '',
      roleType: 'system',
      insertPosition: 4,
    },
    {
      id: 'chat-history',
      name: '聊天历史',
      description: '',
      enabled: true,
      prompt: '',
      roleType: 'system',
      insertPosition: 5,
    },
    {
      id: 'user-instruction',
      name: '用户指令',
      description: '',
      enabled: true,
      prompt: '',
      roleType: 'user',
      insertPosition: 6,
    },
  ],
  createdAt: Date.now(),
  updatedAt: Date.now(),
}
```

## 常见问题

### 为什么当前用户输入可能不在结果里？

取决于是否启用“用户指令”特殊条目，以及调用方是否传入 `userInstruction`。

如果调用方显式传入 `includeUserInstructionMessage: false`，那么当前输入会被排除在本次构建结果之外。

### 为什么压缩摘要没有出现在结果里？

请检查：

1. `compressionSummary` 是否为空。
2. 预设是否启用了 `compression-summary` 条目。
3. 如果是旧预设，没有该条目时，是否仍走了兼容 fallback 注入。

### 为什么知识库没有出现在结果里？

请检查：

1. 是否存在名为“知识库”或 id 为 `knowledge-base` 的启用条目。
2. `knowledgeBases` 是否传入。
3. 对应知识库是否 `globallyEnabled=true`。
4. 知识库条目是否 `enabled=true`。
5. 条目内容是否为空。

### 为什么结果消息数量变少？

如果 `mergeMode='adjacent'`，相邻同角色消息会合并。

如果 `mergeMode='all'`，所有消息会合并到一个 system message。

### 为什么 token 数不精确？

当前估算采用粗略算法，不能替代模型真实 tokenizer。

## 验证建议

```bash
npm run test:run
npm run build
```
