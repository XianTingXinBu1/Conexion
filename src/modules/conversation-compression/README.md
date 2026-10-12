# 会话压缩模块

把过长的对话历史压缩成一份可继续使用的摘要：既回收上下文窗口，又保持对话连续性。

核心规则（阈值、切分、摘要格式、有效历史计算）是**纯函数**，不依赖 Vue 与 UI；
通知、按钮行为集中在 presentation controller。

## 目录结构

```txt
src/modules/conversation-compression/
├── index.ts                                  # 导出 core 纯函数
├── core/
│   └── conversationCompression.ts
├── presentation/
│   ├── index.ts
│   ├── useConversationCompression.ts         # 压缩状态与压缩流程
│   └── useChatCompressionController.ts       # 按钮行为 + 通知
├── components/
│   ├── index.ts
│   └── CompressionSummaryCard.vue
└── __tests__/
    ├── conversationCompression.test.ts
    ├── useConversationCompression.test.ts
    └── useChatCompressionController.test.ts
```

## 分层职责

| 层 | 文件 | 职责 | 约束 |
|---|---|---|---|
| core | `core/conversationCompression.ts` | 阈值钳制 / 用量百分比 / 阈值判定 / 历史切分 / 摘要 prompt 格式 / 有效历史与有效 token 计算 | 纯函数，不 import Vue / UI / 通知 |
| presentation | `useConversationCompression.ts` | 压缩状态、调用 `sendChatRequest` 取摘要、写回 `conversation.compression` 并落库 | 只通过注入的 `sendChatRequest` / `saveConversation` 访问外部 |
| presentation | `useChatCompressionController.ts` | 压缩按钮的前置校验、成功 / 失败 / 取消通知 | **唯一**处理压缩通知的地方 |
| components | `CompressionSummaryCard.vue` | 摘要展示卡片 | 无业务规则 |

## 核心概念

- **`ConversationCompression`**：挂在 `Conversation` 上的压缩记录，含
  `compressedAt` / `summaryContent` / `promptContent` / `sourceMessageIds` /
  `sourceMessageCount` / `keepRecentCount` / `contextBeforeCompression` /
  `contextAfterCompression`。
- **有效历史**：`getEffectiveChatHistory()` 把 `sourceMessageIds` 里的消息从上下文中剔除，
  只留保留的尾部 + 摘要——这是「压缩后还能继续对话」的关键，也是 token 统计的输入。
- **阈值**：默认 75%，钳制在 50%~95%
  （`MIN_COMPRESSION_THRESHOLD_PERCENT` / `MAX_COMPRESSION_THRESHOLD_PERCENT`）。
  `isCompressionThresholdReached` 用与上下文用量**同一口径**的 token 数判断。
- **切分**：默认保留最近 2 条（`DEFAULT_COMPRESSION_KEEP_RECENT_MESSAGES`）；
  手动压缩传 `keepRecentCount: 0`，即压缩全部可见历史。

## 关键行为

- **自动 / 手动**：模式由设置里的 `compressionMode` 决定，但**判断时机在
  `SendMessageUseCase`**（发送前后），不要在 UI controller 里再实现一套阈值判断。
- **自动压缩失败会阻断发送**：`runAutoCompression({ blockOnFailure: true })` 时压缩失败即中止发送；
  压缩摘要会参与后续 Prompt 构建。
- **用户取消不是失败**：`REQUEST_CANCELLED_MESSAGE` 只提示「已取消压缩」，不弹错误。
- **二次压缩合并**：已有摘要会作为 system 消息喂给压缩请求，
  并要求「合并、去重、保留仍有效的信息」，因此摘要不会随压缩次数线性膨胀。
- **token 口径**：阈值判断由聊天层统一解析完整提示词：匹配的 API 实际输入优先，
  新增内容本地估算；无有效 API 基准时完整估算。本地估算统一走 `@/utils/tokenCounter`。
  本模块的历史 / 摘要前后计数仅用于压缩统计，不再作为发送前阈值的独立口径。
- **API 用量隔离**：压缩请求使用独立 `useChatApi` 实例，避免覆盖聊天实际输入基准及用量。

## 调用链

```txt
TokenDetailsPanel / 压缩提示条
  -> handleCompressConversation
    -> useChatCompressionController（本模块 presentation）
      -> useConversationCompression
        -> sendChatRequest / saveConversation
```

## 边界

- core 不依赖 Vue / UI / 通知；通知只在 controller。
- 压缩域不得回到旧路径（`check:architecture` 会判为违规）：
  `utils/conversationCompression.ts`、`composables/useConversationCompression.ts`、
  `features/chat/presentation/useChatCompressionController.ts`、
  `components/chat/CompressionSummaryCard.vue`。
- `ChatPage.vue` 在 `@/modules/*` 中**只允许** import 本模块（用于 `CompressionSummaryCard`）。

## 验证建议

```bash
npm run test:run
npm run check:architecture
```
