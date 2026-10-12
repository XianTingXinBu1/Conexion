# 聊天提示词适配模块

把「当前会话状态」（预设、角色、知识库、历史、用户输入、压缩摘要）适配成上游可用的
`ChatMessage[]`，是聊天**真实发送**与 **Prompt 预览**共用的唯一构建入口。

拼装规则本身在 `src/modules/system-prompt/`；本模块只负责「取哪个预设、传什么上下文、
怎么记录调试信息」，不在这一层重新实现条目填充或合并逻辑。

## 目录结构

```txt
src/modules/chat-prompt/
├── index.ts
├── application/
│   └── buildChatSystemMessages.usecase.ts   # 纯函数 usecase
├── presentation/
│   ├── useChatPromptBuilder.ts              # 预设加载 + 构建 + 调试日志
│   └── useChatPromptPanelController.ts      # Token 面板 / Prompt 预览的开关与上下文装配
└── __tests__/
    └── buildChatSystemMessages.usecase.test.ts
```

## 分层职责

| 层 | 文件 | 职责 | 约束 |
|---|---|---|---|
| application | `buildChatSystemMessages.usecase.ts` | 输入会话上下文，输出 `messages` / `estimatedTokens` / `metadata` | 纯函数，不依赖 Vue / UI / repository |
| presentation | `useChatPromptBuilder.ts` | 加载预设与后端记住的选中项、调用 usecase、写 debug 日志、维护预览状态 | 唯一调用 usecase 的地方 |
| presentation | `useChatPromptPanelController.ts` | Token 详情面板与 Prompt 预览的开关、装配上下文 | 只接线，不做构建 |

## 关键行为

- **单一构建路径**：真实发送与 Prompt 预览都走 `buildSystemMessagesUseCase`，
  不要再开第二条构建逻辑，否则预览与实际发送会分叉。
- **fallback**：`preset` 为 `null` 时返回 `usedFallback: true` 的兜底消息
  （压缩摘要 → 角色 `name` / `description` / `personality` → 历史 → 用户输入），
  保证「没有可用预设也能发消息」。
- **知识库过滤**：只把 `globallyEnabled` 的知识库交给 `buildSystemPrompt`，
  条目级启用状态由 system-prompt 负责。
- **压缩摘要透传**：`compressionSummary` 原样交给 system-prompt，
  本层不做格式化（格式化在 `conversation-compression` 的 `formatCompressionSummaryForPrompt`）。
- **`includeUserInstructionMessage`**：Prompt 预览传 `false`，
  把用户当前输入排除在预览的 `messages` 之外；真实发送保持默认 `true`。
- **token 口径**：`estimatedTokens` 与上下文用量、压缩阈值同口径，
  统一走 `@/utils/tokenCounter`（gpt-tokenizer cl100k），不要引入第二套估算。

## 调用链

```txt
useChatPromptController
  -> useChatPromptBuilder（本模块 presentation）
    -> buildChatSystemMessagesUseCase（本模块 application）
      -> buildSystemPrompt（src/modules/system-prompt/core/builder.ts）
```

## 边界

- 允许依赖：`@/modules/system-prompt`、`@/repositories/promptPresetRepository`、
  `@/modules/debug`。
- 不允许依赖 UI 组件、页面、`features/chat/presentation`。
- 提示词相关业务不要写进 `src/features/chat/application/`，
  旧路径 `features/chat/application/buildSystemMessages.usecase.ts` /
  `composables/useChatPromptBuilder.ts` 已被 `check:architecture` 判为违规。

## 验证建议

```bash
npm run test:run
npm run check:architecture
```
