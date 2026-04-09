# ChatPage 重构蓝图（轻量方案）

> 目标：为 `src/components/ChatPage.vue` 提供低风险拆分路线，优先抽离可复用/可测试逻辑，不贸然重写页面。

## 1. 当前 ChatPage 的职责切分

`ChatPage.vue` 目前同时承担了以下职责：

### A. 页面入口与上下文装配
- 读取 `props.character / characterId / conversationId`
- 路由返回 `router.back()`
- 初始化主题、应用设置、角色、知识库、API 预设
- 按 `characterId` 懒加载 AI 角色

### B. 会话状态管理
- 持有 `messages / displayMessages / loadedCount`
- 调用 `useConversationManager` 进行：
  - 加载会话
  - 创建会话
  - 保存会话
  - 编辑消息
  - 删除消息
- 维护“临时会话 vs 已保存会话”的行为差异

### C. 历史消息窗口与滚动控制
- `loadMessages()` 按 `chatHistoryLimit` 做窗口化展示
- `loadMoreMessages()` 增量加载更早消息
- `scrollToBottom()` 控制滚动位置
- `watch(messages, ...)` 中统一触发窗口刷新与滚动

### D. Token / 上下文统计
- 计算：
  - `currentContextCount`
  - `maxContextLength`
  - `userTokens`
  - `aiTokens`
  - `chatMessageCount / userMessageCount / aiMessageCount`
- 控制 `TokenDetailsPanel` 展示

### E. Prompt Preset / Prompt Preview
- 加载提示词预设与选中项
- `getCurrentPromptPreset()`
- `handleShowPromptAssistant()` 实时构建预览提示词
- 维护：
  - `showPromptPreview`
  - `lastSystemMessages`
  - `lastSystemPromptResult`

### F. 消息发送编排（最重）
- 重置 usage
- 加载 regex 规则
- 用户输入宏后处理 `applyRules(..., 'user', 'after-macro')`
- 插入用户消息
- 新建或保存会话
- 预插入 assistant 占位消息
- 构建 chat history
- 构建 system prompt
- 调用 `sendStreamChatRequest`
- 流式更新 assistant 内容
- assistant 输出再次套 regex
- 成功/失败通知
- 请求完成后持久化

### G. 消息编辑/删除 UI 交互
- 编辑弹窗开关
- 删除确认弹窗开关
- 回写本地 messages 与持久化层

### H. 运行期资源加载
- `loadRegexRules`
- `loadPromptPresets`
- `loadAICharacter`
- `onMounted` 启动序列

---

## 2. 直接依赖与耦合面

### 组件依赖
- `ChatInput`
- `MessageItem`
- `ContextRing`
- `TokenDetailsPanel`
- `EditMessageModal`
- `PromptPreviewModal`

### composables / modules 依赖
- `useChatApi`
- `useConversationManager`
- `useConfirmDialog`
- `useCharacters`
- `useKnowledgeBases`
- `useApiPresets`
- `useAppSettings`
- `useTheme`
- `buildSystemPrompt`
- `applyRules / clearRegexCache`
- `countMessagesTokens`
- `useNotifications`

### 当前主要耦合问题
1. **页面组件持有完整业务编排**：发送链路、提示词构建、消息窗口、会话持久化都在同一文件。
2. **同一份 `messages` 同时承担 UI 源数据与业务源数据**：导致滚动、统计、持久化、副作用彼此交叉。
3. **Prompt Preview 与真实发送各自构建一次提示词**：逻辑基本重复。
4. **流式请求阶段直接 mutate `messages`**：使发送状态、保存时机、UI 刷新强耦合。
5. **初始化职责过多**：角色、知识库、预设、会话、规则全部在页面启动时串行处理。

---

## 3. 建议拆分目标与模块 I/O

下面按“低侵入、能逐步迁移”的原则设计。

### 3.1 `useChatSession`

**职责**
- 托管聊天主消息源与会话持久化适配
- 统一封装：加载会话 / 新建会话 / 保存会话 / 编辑 / 删除
- 暴露“临时会话能力边界”

**输入**
- `conversationId?: string`
- `currentCharacter: Ref<AICharacter | undefined>`

**输出**
- `messages: Ref<Message[]>`
- `currentConversation`
- `loadConversation()`
- `ensureConversationCreated(firstMessage)`
- `saveConversation()`
- `editMessage(messageId, content)`
- `deleteMessage(messageId)`
- `isTemporaryConversation: ComputedRef<boolean>`

**备注**
- 本质是给 `useConversationManager` 做一层页面友好的 adapter。
- 这层可以先抽，不需要动发送链路。

---

### 3.2 `useChatViewport`

**职责**
- 管理历史消息分页展示和滚动定位
- 将 `messages` 映射为 `displayMessages`
- 处理“加载更多”“保持滚动位置”“滚到底部”

**输入**
- `messages: Ref<Message[]>`
- `chatHistoryLimit: Ref<number>`
- `messagesContainer: Ref<HTMLElement | undefined>`

**输出**
- `displayMessages`
- `loadedCount`
- `hasMoreMessages`
- `loadInitialWindow()`
- `loadMoreMessages()`
- `scrollToBottom()`
- 可选：`syncDisplayWindow()`

**备注**
- 这是最适合先拆的纯 UI 状态模块。
- 与 API / 持久化耦合极弱，回归风险低。

---

### 3.3 `useChatStats`

**职责**
- 聚合 Token / 消息统计逻辑
- 服务 `ContextRing` 与 `TokenDetailsPanel`

**输入**
- `messages: Ref<Message[]>`
- `currentApiPreset: Ref<Preset | undefined>`

**输出**
- `currentContextCount`
- `maxContextLength`
- `userTokens`
- `aiTokens`
- `chatMessageCount`
- `userMessageCount`
- `aiMessageCount`

**备注**
- 完全是派生数据，优先级很高。
- 可顺手补单测，因为依赖纯函数较多。

---

### 3.4 `usePromptPreview`

**职责**
- 管理提示词预设加载、选中项、预览构建结果
- 抽出“构建 system messages”共用逻辑

**输入**
- `currentCharacter`
- `selectedUser`
- `knowledgeBases`
- `messages`
- `promptMergeMode`

**输出**
- `promptPresets`
- `selectedPromptPresetId`
- `loadPromptPresets()`
- `currentPromptPreset`
- `buildPromptPreview(userInstruction?: string, options?)`
- `lastSystemMessages`
- `lastSystemPromptResult`
- `showPromptPreview`
- `openPromptPreview()`
- `refreshPromptPreview()`

**建议补一个统一返回结构**
```ts
interface BuiltPromptPayload {
  systemMessages: ChatMessage[];
  summary: {
    estimatedTokens: number;
    metadata?: unknown;
  };
}
```

**备注**
- 当前 `handleShowPromptAssistant` 与 `handleSendMessage` 里有重复系统提示词构建逻辑。
- 先把“构建”抽出来，再决定 UI modal 状态是否也并入这个 composable。

---

### 3.5 `useMessageEditor`

**职责**
- 编辑弹窗与删除确认弹窗的 UI 状态管理
- 对接 `useChatSession` 的 edit/delete 能力

**输入**
- `messages`
- `editMessage`
- `deleteMessage`
- `showSuccess`
- `showError`

**输出**
- `showEditModal`
- `editingMessageId`
- `editingMessageContent`
- `handleEditMessage()`
- `handleSaveEdit()`
- `handleDeleteMessage()`
- `confirmDelete()`
- `cancelDelete()`
- `confirmDialogProps`
- `ConfirmDialogComponent`

**备注**
- 这是典型“页面操作器”模块，适合在后期抽离。
- 因为依赖通知与弹窗，优先级略低于 viewport/stats。

---

### 3.6 `useChatFlow`

**职责**
- 托管发送链路，是未来核心 orchestrator
- 负责：
  - 输入预处理（regex）
  - 用户消息入列
  - assistant 占位消息入列
  - prompt 构建
  - chat history 组装
  - 调 API
  - 流式更新
  - 成功/失败落盘与通知

**输入**
- `messages`
- `currentCharacter`
- `selectedUser`
- `knowledgeBases`
- `promptMergeMode`
- `create/save conversation helpers`
- `sendStreamChatRequest`
- `showSuccess/showError`
- `scrollToBottom`
- `buildPromptPreview` 或更底层 `buildPromptPayload`

**输出**
- `handleSendMessage(content: string)`
- `isSending`
- `lastSystemMessages`
- `lastSystemPromptResult`
- 可选：`abortSend()`

**备注**
- 这是最重的一层，不建议第一个拆。
- 它应该依赖已收口的 `useChatSession + usePromptPreview + useChatViewport`，否则只会把大杂烩搬家。

---

### 3.7 `useChatBootstrap`

**职责**
- 页面启动阶段的数据加载编排
- 负责 mounted 时的顺序控制

**输入**
- `props`
- 各种 `load/init` 方法

**输出**
- `bootstrap()`
- `isBootstrapping`
- `bootstrapError`

**备注**
- 这个模块不是第一优先级，但在主逻辑拆散后很有价值。
- 可以把当前 onMounted 的串行调用移进去，令 `ChatPage.vue` 更接近“装配层”。

---

## 4. 哪些能先拆，哪些要等 API / 状态层先收口

## 可优先拆（低风险）

### 第一组：纯派生 / 纯 UI 协调
1. `useChatStats`
2. `useChatViewport`
3. `usePromptPreview` 中的“纯构建函数”部分

**原因**
- 不改接口，不碰存储层，不碰 API 请求时序。
- 可以保持模板几乎不动，只把 `<script setup>` 变量来源迁走。

### 第二组：页面适配层
4. `useChatSession`
5. `useMessageEditor`

**原因**
- 这些更多是把页面中散落的 CRUD 行为收拢。
- 对现有 `useConversationManager` 属于包一层，不必立即改底层数据结构。

---

## 需要等待收口后再拆（中高风险）

### `useChatFlow`
应在以下条件更明确后再拆：
1. **会话写入时机统一**：
   - 现在创建会话、保存会话、流式完成后保存是分散的。
2. **prompt 构建能力单点化**：
   - 预览与真实发送使用同一 builder 封装。
3. **streaming 状态模型更清楚**：
   - 当前没有显式 `isSending / currentRequestId / abortController`。
4. **regex 处理阶段定义固定**：
   - 现在是 user 和 assistant 都在 `after-macro` 阶段处理，且 assistant 在 streaming chunk 期间反复 apply。

### `useChatBootstrap`
建议在页面主要状态边界确定后再抽，否则只是把“很多 await”换个地方堆放。

---

## 5. 分阶段落地顺序

## Phase 0：先补边界文档（现在即可做）
- 在仓库中加入当前蓝图文档
- 明确模块边界与拆分顺序

**收益**
- 防止后续开发直接把逻辑搬成更大的 composable。

---

## Phase 1：提炼纯派生逻辑

### 目标
- 抽 `useChatStats`
- 抽 `useChatViewport`

### 预期改动
- `ChatPage.vue` 中删除统计类 computed
- `loadMessages / loadMoreMessages / scrollToBottom / hasMoreMessages / loadedCount / displayMessages` 迁出

### 风险
- 滚动位置恢复容易出回归
- `watch(messages, ...)` 改写后可能重复滚到底部

### 风险控制
- 保持现有 `messagesContainer` DOM ref 不变
- 保持模板结构不变
- 用手工 smoke test 验证：
  1. 初次进入页面自动滚底
  2. 发送消息后滚底
  3. 点击“加载更多”后视口不跳
  4. 修改 `chatHistoryLimit` 后显示条数正常

---

## Phase 2：统一 Prompt 构建入口

### 目标
- 抽 `usePromptPreview`
- 先把“构建 prompt payload”做成复用函数

### 预期改动
- `handleShowPromptAssistant` 和 `handleSendMessage` 不再各自拼 systemMessages
- `getCurrentPromptPreset / loadPromptPresets / lastSystemMessages / lastSystemPromptResult` 收口

### 风险
- 预览结果与真实发送结果不一致
- `chatHistory` / `userInstruction` 输入边界容易搞错

### 风险控制
- 固定一个公共方法，例如：
```ts
buildPromptPayload({
  chatHistory,
  userInstruction,
  mode: 'preview' | 'send'
})
```
- 对比重构前后：
  - 空预设
  - 有角色
  - 有知识库
  - 有聊天历史
  - 有用户输入

---

## Phase 3：抽会话适配层与编辑动作

### 目标
- 抽 `useChatSession`
- 抽 `useMessageEditor`

### 预期改动
- 页面不再直接调用 `useConversationManager` 的多个方法
- 编辑/删除状态与通知逻辑迁移到独立 composable

### 风险
- 临时会话行为被改变
- 编辑/删除成功后本地 `messages` 与 storage 状态不同步

### 风险控制
- 明确保留当前行为：
  - 临时会话不能编辑/删除
  - 已保存会话编辑/删除后要同步更新页面 `messages`
- 增加最小 smoke case：
  1. 临时会话编辑失败提示仍在
  2. 正常会话编辑成功后立刻可见
  3. 删除后列表和 token 统计同步更新

---

## Phase 4：最后才抽发送编排

### 目标
- 抽 `useChatFlow`

### 推荐前提
- 前三阶段已完成
- Prompt builder 已单点化
- 会话与 viewport 都有稳定边界

### 风险
- 这是最容易引入细碎回归的阶段：
  - streaming 文本覆盖/重复
  - assistant 占位消息未正确保存
  - prompt 或 chat history 传参偏移
  - 通知触发时机变化

### 风险控制
- 先“不改行为，只搬代码”
- 不在同一阶段叠加新增功能（如取消发送、重试、并发发送）
- 若可行，增加轻量日志断点：
  - userMessageId
  - assistantMessageId
  - prompt message count
  - saveConversation 调用时机

---

## 6. 建议的最终页面形态

理想情况下，`ChatPage.vue` 最终只保留：

### 页面层保留内容
- props / router
- DOM refs
- 组合各个 composables
- 模板事件绑定

### 页面层不再直接处理
- prompt 组装细节
- streaming 更新细节
- token 统计细节
- 历史消息分页与滚动细节
- 编辑/删除弹窗业务细节

### 目标结构示意
```ts
const session = useChatSession(...)
const viewport = useChatViewport(...)
const stats = useChatStats(...)
const promptPreview = usePromptPreview(...)
const editor = useMessageEditor(...)
const chatFlow = useChatFlow({
  ...session,
  ...viewport,
  ...promptPreview,
})
```

这样 `ChatPage.vue` 会变成“装配页”，而不是“业务总控器”。

---

## 7. 建议暂时不要做的事

1. **不要马上把所有逻辑一次性拆成 5~7 个 composables**
   - 很容易搬出更多隐式耦合。
2. **不要先改 `useConversationManager` 底层存储结构**
   - 当前目标是页面收口，不是状态层重写。
3. **不要顺手引入 Pinia / 全局 chat store**
   - 这会把局部重构升级成架构迁移。
4. **不要在拆分同时重做 UI**
   - 视觉改动会掩盖行为回归。

---

## 8. 一些额外观察（供后续重构参考）

### 8.1 `watch(messages, { deep: true })` 过于宽泛
当前 assistant 流式输出时，每个 chunk 都会触发：
- `loadMessages()`
- `scrollToBottom()`

这虽然工作正常，但意味着：
- 展示窗口和滚动控制被高频触发
- 后续若性能有问题，这里会是首个热点

**建议**
- 在 `useChatViewport` 中区分：
  - 消息条数变化
  - 当前最后一条内容变化
- 或至少显式提供 `syncAfterAppend()` / `syncAfterStreamChunk()` 两类入口

### 8.2 assistant chunk 期间每次都跑 regex
当前在 streaming 过程中：
```ts
msg.content += chunk;
msg.content = applyRules(msg.content, 'assistant', 'after-macro', regexRules.value);
```
如果规则不是幂等的，可能出现内容重复处理的副作用。

**建议**
- 后续考虑改为：
  - 流式过程中只拼原文 rawContent
  - 完成后统一对最终文本 applyRules
- 但这属于行为调整，不建议和本轮拆分同时做。

### 8.3 Prompt preview 的索引键存在潜在错位
`PromptPreviewModal` 对过滤后的列表使用 `filteredIndex` 做折叠状态 key；当搜索过滤后，索引与原列表不再稳定对应。

**建议**
- 未来改为基于消息的稳定 key（例如 `role + hash(content)` 或传入显式 id）
- 这属于局部组件优化，可独立处理

---

## 9. 推荐执行摘要

### 最优先
- `useChatViewport`
- `useChatStats`
- `usePromptPreview`（先抽构建逻辑）

### 第二优先
- `useChatSession`
- `useMessageEditor`

### 最后处理
- `useChatFlow`
- `useChatBootstrap`

### 原则
- 先拆“派生与 UI 协调”，再拆“持久化适配”，最后拆“发送编排”
- 每阶段只做一类收口，避免行为变化叠加
