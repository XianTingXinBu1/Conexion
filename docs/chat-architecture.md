# Chat Architecture

本文档说明 Conexion 当前聊天模块的分层、职责和边界规则。

> 文档同步状态：随 2026-09-20 的聊天专属 composable 迁移一并更新（8 个 useChat* 已从 `src/composables/` 迁入 `src/features/chat/presentation/`）。
> 最后校对：2026-09-20。

## 当前状态

聊天页已经从早期的“大页面总控”收敛为较薄的 View：

```txt
src/components/ChatPage.vue
```

当前核心分层：

```txt
View -> ViewModel -> Controller/Facade -> UseCase -> Repository/Gateway -> Storage/API
```

目标：

- 页面只负责渲染和事件绑定。
- ViewModel 负责组装页面依赖。
- Controller / Facade 管一类页面行为。
- UseCase 承载可测试的业务流程。
- Repository 是接触存储 key / default 的入口。
- 架构边界由 `npm run check:architecture` 检查。

## 关键文件

### View

```txt
src/components/ChatPage.vue
```

职责：

- 定义页面 props。
- 调用 `useChatPageViewModel(props)`。
- 绑定模板状态和事件。
- 引入聊天 UI 组件和样式。

禁止：

- 不直接 import `@/utils/storage`。
- 不直接 import `@/constants`。
- 不直接 import repository / service / api / module / composable 业务细节。
- 不写发送、压缩、prompt、会话保存逻辑。

### ViewModel

```txt
src/features/chat/presentation/useChatPageViewModel.ts
```

职责：

- 聊天页面的 composition root。
- 组装 settings / theme / api / notifications / viewport / scroll / controller / facade / send flow。
- 把多个 controller 暴露为页面模板需要的数据。

注意：

- ViewModel 可以承担装配职责。
- 复杂业务规则不要写在 ViewModel 中。
- 复杂业务应下沉到 controller / usecase / repository。

### Presentation Controllers / Facades

```txt
src/features/chat/presentation/useChatSessionFacade.ts
src/features/chat/presentation/useChatPromptController.ts
src/features/chat/presentation/useChatLifecycleController.ts
src/features/chat/presentation/chatPageTypes.ts

src/modules/conversation-compression/presentation/useChatCompressionController.ts
src/modules/conversation-compression/presentation/useConversationCompression.ts
```

职责：

- `useChatSessionFacade`：会话加载、创建、保存、编辑、删除、临时会话判断。
- `useChatCompressionController`：压缩按钮行为、压缩通知、压缩状态适配（属于压缩模块）。
- `useChatPromptController`：prompt builder、prompt preview、token details 控制。
- `useChatLifecycleController`：页面初始化、regex 加载、生命周期绑定。
- `chatPageTypes`：页面 props 类型。

### Vue Adapter

```txt
src/features/chat/presentation/useChatSendFlow.ts
```

职责：

- Vue ref 和 `SendMessageUseCase` 的适配层。
- 管理 `isSending`。
- 将通知和 UI effect 分组传给 usecase。

注意：

- 它不应重新承载完整发送业务流程，只做 Vue ref 与 usecase 之间的适配。

聊天专属的 composable 均位于 `src/features/chat/presentation/`，全局
`src/composables/` 只保留跨页面通用能力；该约束由架构脚本固定（见边界规则）。

### Application UseCases

```txt
src/features/chat/application/sendMessage.usecase.ts
src/features/chat/application/streamMessageAssembler.ts

src/modules/chat-prompt/application/buildChatSystemMessages.usecase.ts
```

职责：

- `sendMessage.usecase`：发送消息主流程。
- `streamMessageAssembler`：stream chunk buffer、flush、assistant regex 应用。
- `buildChatSystemMessages.usecase`：统一真实发送和 prompt 预览的系统提示词构建入口（属于 chat-prompt 模块）。

禁止：

- 不 import Vue。
- 不 import UI 组件。
- 不 import notification / composables / storage。

### Repositories

```txt
src/repositories/characterRepository.ts
src/repositories/regexRuleRepository.ts
src/repositories/knowledgeBaseRepository.ts
src/repositories/promptPresetRepository.ts
src/repositories/apiPresetRepository.ts
src/repositories/settingsRepository.ts
```

职责：

- 作为后端 API 数据适配层。
- 集中接触 `/api/*`、`STORAGE_KEYS`、默认值与错误处理。
- 为 composables / controllers / usecases 提供语义化读写方法，避免业务代码直接依赖浏览器持久化。

## 发送消息调用链

```txt
ChatPage.vue
  -> useChatPageViewModel
    -> useChatSendFlow
      -> SendMessageUseCase.execute
        -> loadRegexRules
        -> apply user regex
        -> auto compression if needed
        -> create/save conversation
        -> buildChatSystemMessagesUseCase
        -> sendStreamChatRequest
        -> StreamMessageAssembler
        -> saveConversation
        -> UI adapter shows success/error
```

## Prompt 构建调用链

```txt
useChatPromptController
  -> useChatPromptBuilder（src/modules/chat-prompt/presentation/）
    -> buildChatSystemMessagesUseCase（src/modules/chat-prompt/application/）
      -> buildSystemPrompt（src/modules/system-prompt/core/builder.ts）
```

真实发送和 prompt 预览都使用同一个 `buildChatSystemMessagesUseCase`，避免两套构建逻辑分叉。

## 会话压缩调用链

```txt
TokenDetailsPanel / compression warning
  -> handleCompressConversation
    -> useChatCompressionController（src/modules/conversation-compression/presentation/）
      -> useConversationCompression
        -> sendChatRequest
        -> saveConversation
```

压缩通知只在 presentation controller 中处理，压缩核心规则（阈值、切分、摘要格式、有效历史计算）位于 `src/modules/conversation-compression/core/conversationCompression.ts`，不依赖 Vue 与 UI。

## API 代理链路

前端 API client 不直接请求上游大模型接口，而是请求本地后端代理：

```txt
src/api/*
  -> /api/*
    -> server/index.ts（进程入口）
      -> server/app.ts + server/routes/*.ts
        -> server/upstream/client.ts
          -> upstream OpenAI-compatible API
```

后端当前支持：

```txt
GET  /api/health
GET  /api/models
POST /api/models
POST /api/connection-test
POST /api/chat/completions
```

## 架构边界检查

命令：

```bash
npm run check:architecture
```

健康检查也会执行它：

```bash
npm run health-check
```

规则由 `scripts/check-architecture-boundaries.js` 固化：

1. `ChatPage.vue` 只依赖 chat presentation 入口、chat UI、压缩模块与共享样式。
   不允许 import composables / repositories / services / api，
   也不允许 import 除 `conversation-compression` 之外的 modules。
2. chat presentation 不允许直接 import `@/utils/storage` / `@/constants`。
3. chat application 不允许 import Vue / UI 组件 / storage / notification / composables。
4. 压缩域与 chat-prompt 适配层不允许回到旧路径（`utils/`、`composables/`、
   `features/chat/application/` 等）。
5. 聊天专属 composable 不允许回到 `src/composables/`。
6. `modules/system-prompt` 不允许依赖 features / composables / repositories / components。

> 路径类规则请用 `banned: true`（按文件位置判定）。此前用
> `forbidden: [/.*/]` 表达时，因为 `forbidden` 匹配的是 import 说明符，
> 一个不含任何 import 的文件可以绕过检查。

## 新增聊天能力时怎么放

### 新 UI

优先放在：

```txt
src/components/chat/
```

如果后续继续 feature 化，可迁到：

```txt
src/features/chat/presentation/components/
```

### 新页面状态 / UI 行为

优先新建或扩展：

```txt
src/features/chat/presentation/useXxxController.ts
```

### 新业务流程

放在：

```txt
src/features/chat/application/xxx.usecase.ts
```

要求可单测，不能 import Vue / UI / storage。

提示词构建、预设加载等聊天提示词相关业务不要放进 `features/chat/application`，而是放在：

```txt
src/modules/chat-prompt/
  application/   # usecase
  presentation/  # builder / panel controller
```

会话压缩相关业务放在：

```txt
src/modules/conversation-compression/
  core/          # 纯函数规则（阈值 / 切分 / 摘要格式）
  presentation/  # controller / composable
  components/    # 摘要卡片等 UI
```

### 新存储读写

放在：

```txt
src/repositories/xxxRepository.ts
```

不要在页面、controller、usecase 里直接写 `STORAGE_KEYS`。

## 验证命令

推荐改聊天相关代码后至少跑：

```bash
npm run test:run
npm run check:architecture
```

涉及类型、构建或较大改动时再跑：

```bash
npm run build
```

提交前可跑完整健康检查：

```bash
npm run health-check
```
