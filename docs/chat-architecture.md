# Chat Architecture

本文档说明 Conexion 聊天模块重构后的分层、职责和边界规则。

## 目标

聊天模块遵循：

```txt
View -> ViewModel -> Controller/Facade -> UseCase -> Repository/Gateway -> Storage/API
```

核心目标：

- 页面只渲染和绑定事件。
- ViewModel 只做页面组合。
- Controller/Facade 管一类页面行为。
- UseCase 承载可测试的业务流程。
- Repository 是唯一接触存储 key/default 的入口。
- 架构边界由 `npm run check:architecture` 检查。

## 当前关键文件

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
- 不直接 import repository/service/api/composable 业务细节。
- 不写发送、压缩、prompt、会话保存逻辑。

### ViewModel

```txt
src/features/chat/presentation/useChatPageViewModel.ts
```

职责：

- 聊天页面的 composition root。
- 组装 settings/theme/api/notifications/viewport/scroll/controller/facade/useChatSendFlow。
- 把多个 controller 暴露为页面模板需要的数据。

注意：

- ViewModel 可以较长，但不能写复杂业务规则。
- 复杂业务必须下沉到 controller/usecase/repository。

### Presentation Controllers / Facades

```txt
src/features/chat/presentation/useChatSessionFacade.ts
src/features/chat/presentation/useChatCompressionController.ts
src/features/chat/presentation/useChatPromptController.ts
src/features/chat/presentation/useChatLifecycleController.ts
src/features/chat/presentation/chatPageTypes.ts
```

职责：

- `useChatSessionFacade`：会话加载、创建、保存、编辑、删除、临时会话判断。
- `useChatCompressionController`：压缩按钮行为、压缩通知、压缩状态适配。
- `useChatPromptController`：prompt builder、prompt preview、token details 控制。
- `useChatLifecycleController`：页面初始化、regex 加载、生命周期绑定。
- `chatPageTypes`：页面 props 类型。

### Vue Adapter

```txt
src/composables/useChatSendFlow.ts
```

职责：

- Vue ref 和 `SendMessageUseCase` 的适配层。
- 管理 `isSending`。
- 将通知和 UI effect 分组传给 usecase。

它不再直接承载完整发送业务流程。

### Application UseCases

```txt
src/features/chat/application/sendMessage.usecase.ts
src/features/chat/application/streamMessageAssembler.ts
src/features/chat/application/buildSystemMessages.usecase.ts
```

职责：

- `sendMessage.usecase`：发送消息主流程。
- `streamMessageAssembler`：stream chunk buffer、flush、assistant regex 应用。
- `buildSystemMessages.usecase`：统一真实发送和 prompt 预览的系统提示词构建入口。

禁止：

- 不 import Vue。
- 不 import UI 组件。
- 不 import notification/composables/storage。

### Repositories

```txt
src/repositories/characterRepository.ts
src/repositories/regexRuleRepository.ts
src/repositories/knowledgeBaseRepository.ts
src/repositories/promptPresetRepository.ts
src/repositories/apiPresetRepository.ts
```

职责：

- 唯一接触 `STORAGE_KEYS`、`DEFAULT_*`、`getStorage`、`setStorage` 的新存储适配层。
- 为 composables / controllers / usecases 提供语义化读写方法。

## 发送消息调用链

```txt
ChatPage.vue
  -> useChatPageViewModel
    -> useChatSendFlow
      -> SendMessageUseCase.execute
        -> loadRegexRules
        -> apply user regex
        -> create/save conversation
        -> buildSystemMessagesUseCase
        -> sendStreamChatRequest
        -> StreamMessageAssembler
        -> saveConversation
        -> UI adapter shows success/error
```

## Prompt 构建调用链

```txt
useChatPromptController
  -> useChatPromptBuilder
    -> buildSystemMessagesUseCase
      -> buildSystemPrompt
```

真实发送和 prompt 预览都使用同一个 `buildSystemMessagesUseCase`，避免两套构建逻辑分叉。

## 会话压缩调用链

```txt
TokenDetailsPanel / compression warning
  -> handleCompressConversation
    -> useChatCompressionController
      -> useConversationCompression
        -> sendChatRequest
        -> saveConversation
```

压缩通知只在 presentation controller 中处理，压缩核心逻辑仍在 composable/utility 层。

## 架构边界检查

命令：

```bash
npm run check:architecture
```

健康检查也会执行它：

```bash
npm run health-check
```

当前检查规则包括：

1. `ChatPage.vue` 不允许直接 import：
   - composables
   - repositories
   - services
   - modules
   - api

2. chat presentation 不允许直接 import：
   - `@/utils/storage`
   - `@/constants`

3. chat application 不允许 import：
   - Vue
   - UI components
   - storage
   - notification
   - composables

## 新增聊天能力时怎么放

### 新 UI

放在：

```txt
src/components/chat/
```

或后续迁到：

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

要求可单测，不能 import Vue/UI/storage。

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
npm run build
```

提交前可跑完整健康检查：

```bash
npm run health-check
```
