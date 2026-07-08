# 系统提示词构建模块总结

## 模块定位

`src/modules/system-prompt` 是 Conexion 的 Prompt / 上下文构建核心模块。

它负责把：

- Prompt 预设
- AI 角色
- 用户角色
- 知识库
- 压缩摘要
- 聊天历史
- 用户当前输入

组合成 OpenAI Chat API 格式的 `messages` 数组。

## 当前集成状态

当前聊天模块通过 usecase 使用它：

```txt
ChatPage.vue
  -> useChatPageViewModel
    -> useChatPromptController / useChatSendFlow / useChatStats
      -> buildSystemMessagesUseCase
        -> buildSystemPrompt
```

相关文件：

```txt
src/modules/chat-prompt/application/buildChatSystemMessages.usecase.ts
src/modules/chat-prompt/presentation/useChatPromptBuilder.ts
src/features/chat/presentation/useChatPromptController.ts
src/features/chat/application/sendMessage.usecase.ts
src/composables/useChatStats.ts
```

## 文件结构

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

## 核心能力

### 1. buildSystemPrompt

核心构建函数。

输入：

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

输出：

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

### 2. fillItemContent / 特殊条目识别

识别并填充特殊条目：

| 条目名称 / ID | 占位符类型 | 数据来源 |
|---------|-----------|---------|
| 角色设定 / `character-setting` | `character` | `aiCharacter` |
| 用户设定 / `user-setting` | `user` | `userCharacter` |
| 知识库 / `knowledge-base` | `knowledge` | `knowledgeBases` |
| 压缩摘要 / `compression-summary` | `compression-summary` | `compressionSummary` |
| 聊天历史 / `chat-history` | `chat-history` | `chatHistory` |
| 用户指令 / `user-instruction` | `user-instruction` | `userInstruction` |

当前实现优先按 **内置条目 ID** 识别，再退回名称匹配，稳定性比旧实现更高。

### 3. mergeMessages

支持三种合并模式：

- `none`：不合并。
- `adjacent`：合并相邻同类型消息，推荐默认值。
- `all`：合并所有消息到一个 system message。

### 4. Token 估算

提供粗略 token 估算：

```typescript
estimateTokens(text)
estimateMessagesTokens(messages)
```

## 构建流程

1. 设置默认配置。
2. 按 `insertPosition` 排序 Prompt 条目。
3. 跳过未启用条目。
4. 识别并填充特殊条目。
5. 处理 `compression-summary`。
6. 处理 `chat-history` 和 `user-instruction`。
7. 过滤空内容。
8. 合并消息。
9. 估算 token。
10. 返回结果与 metadata。

兼容逻辑：

- 新预设应显式包含 `compression-summary` 条目。
- 旧预设缺少该条目时，仍会保留压缩摘要前置注入，避免历史数据失效。

## 设计原则

- 不依赖 Vue。
- 不访问 storage。
- 不请求 API。
- 不处理 UI 通知。
- 只做最终 Prompt messages 构建。
- 结果可解释、可测试、可预览。
- 尽量作为发送 / 预览 / 统计的单一真源。

## 开发注意事项

- 新增特殊占位符时，需要同时更新：
  - `types.ts`
  - `core/content-filler.ts`
  - `utils/constants.ts`
  - 默认预设与 UI
  - 测试
  - README / USAGE
- 不要在页面中重新拼 system prompt。
- 不要让发送层再手动补一份聊天历史。
- 不要把 API 请求逻辑放入本模块。

## 验证命令

```bash
npm run test:run
npm run build
```

如果涉及聊天发送链路：

```bash
npm run check:architecture
```
