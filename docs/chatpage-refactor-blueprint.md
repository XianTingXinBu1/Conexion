# ChatPage 重构蓝图

这份文档记录 `src/components/ChatPage.vue` 当前状态和后续重构方向。

## 当前状态

`ChatPage.vue` 已经不再是早期的大型业务页面。

当前职责：

- 调用 `useChatPageViewModel(props)`。
- 渲染聊天头部、消息列表、输入框、Token 详情、编辑弹窗、Prompt 预览、删除确认。
- 绑定页面事件。

当前主要业务逻辑已经迁出到：

```txt
src/features/chat/presentation/useChatPageViewModel.ts
src/features/chat/presentation/useChatSessionFacade.ts
src/features/chat/presentation/useChatCompressionController.ts
src/features/chat/presentation/useChatPromptController.ts
src/features/chat/presentation/useChatLifecycleController.ts
src/composables/useChatSendFlow.ts
src/features/chat/application/sendMessage.usecase.ts
src/features/chat/application/buildSystemMessages.usecase.ts
src/features/chat/application/streamMessageAssembler.ts
```

## 已完成的重构

### 1. ChatPage 瘦身

`ChatPage.vue` 当前主要是 View，不再直接承担：

- 会话存储读写
- Prompt 构建
- regex 加载和应用
- streaming 组装
- 发送主流程
- 压缩主流程

### 2. Prompt 构建入口统一

真实发送和 Prompt 预览都经由：

```txt
src/features/chat/application/buildSystemMessages.usecase.ts
```

底层使用：

```txt
src/modules/system-prompt/core/builder.ts
```

### 3. 会话行为收口

聊天页会话相关行为已收口到：

```txt
src/features/chat/presentation/useChatSessionFacade.ts
```

它负责：

- 加载会话
- 创建会话
- 保存会话
- 编辑消息
- 删除消息
- 判断是否允许会话压缩

### 4. 发送流程下沉

发送主流程已进入：

```txt
src/features/chat/application/sendMessage.usecase.ts
```

它负责：

- 重置 usage
- 加载 regex
- 处理用户输入规则
- 自动压缩判断
- 创建 / 保存会话
- 构建 system messages
- 插入 assistant 占位消息
- 驱动 stream 请求
- 保存最终结果

### 5. 架构边界检查

脚本：

```txt
scripts/check-architecture-boundaries.js
```

命令：

```bash
npm run check:architecture
```

当前会限制：

- `ChatPage.vue` 不直接依赖业务 composable / repository / service / module / api。
- chat presentation 不直接访问 raw storage / constants。
- chat application 不依赖 Vue / UI / storage / notification / composables。

## 当前仍值得关注的点

### 1. `useChatPageViewModel` 是新的装配中心

文件：

```txt
src/features/chat/presentation/useChatPageViewModel.ts
```

它需要组装许多依赖，天然会偏长。

原则：

- 可以做 composition root。
- 不要写复杂业务规则。
- 复杂流程继续下沉到 controller / facade / usecase。

如果继续增长，可按区域拆出：

```txt
useChatPageDataSources.ts
useChatPageControllers.ts
useChatPageUiState.ts
```

但只有在真的变复杂时再拆，避免空中楼阁。

### 2. `useChatSendFlow` 仍在全局 composables

文件：

```txt
src/composables/useChatSendFlow.ts
```

它现在是 Vue adapter，不是发送业务本体。

后续可考虑迁到：

```txt
src/features/chat/presentation/useChatSendFlow.ts
```

收益：

- 聊天专属逻辑更靠近 chat feature。
- 全局 composables 更干净。

风险：

- 需要同步调整测试和 import。
- 不应顺手改行为。

建议作为独立小任务处理。

### 3. stream 与 regex 的行为边界

当前发送流程中：

- 用户输入 regex 在 `SendMessageUseCase` 中处理。
- assistant stream 内容由 `StreamMessageAssembler` 累积和 flush。

需要注意：

- assistant regex 应尽量保持幂等。
- 不要在结构重构时混入 regex 行为变更。

### 4. 自动压缩时机

当前自动压缩由 `SendMessageUseCase` 在发送前判断。

需要注意：

- 压缩失败应中止发送并提示。
- 压缩摘要参与 Prompt 构建。
- 不要让 UI controller 和 usecase 各自判断一套压缩规则。

## 后续建议路线

### 第一阶段：只做边界清理

目标：不改变行为，只移动和命名更清楚。

建议任务：

1. 将 `useChatSendFlow` 迁到 `features/chat/presentation`。
2. 更新相关测试路径。
3. 跑 `npm run test:run` 和 `npm run check:architecture`。

### 第二阶段：继续瘦 ViewModel

触发条件：

- `useChatPageViewModel` 继续明显增长。
- 新增功能需要更多依赖装配。

可拆方向：

- 数据源初始化
- 控制器组装
- UI 状态导出

原则：

- 不为拆而拆。
- 拆出来的文件必须职责清晰。
- 不要让多个文件互相传递一大坨未命名 deps。

### 第三阶段：会话领域继续收口

候选目标：

```txt
conversation application usecases
conversation repository
conversation presentation adapters
```

收益：

- 会话列表页和聊天页共享更清晰的会话能力。
- 降低 `useConversationManager` 与页面之间的耦合。

### 第四阶段：页面级测试补强

优先测试：

- 发送消息成功路径
- 发送取消路径
- 发送失败路径
- 自动压缩触发路径
- Prompt 预览刷新路径

## 不建议做的事

- 不建议一口气把整个项目迁入 feature sliced 目录。
- 不建议在迁文件时顺手改发送、压缩、regex 行为。
- 不建议为了减少行数拆出无语义的 `utils`。
- 不建议让 usecase 直接调用 notification、router、DOM scroll。

## 验证命令

聊天相关结构调整后建议运行：

```bash
npm run test:run
npm run check:architecture
npm run build
```

提交前可运行：

```bash
npm run health-check
```

## 一句话总结

`ChatPage.vue` 的核心瘦身已经完成。下一步重点不是继续追求页面行数，而是防止 `useChatPageViewModel` 和 `useChatSendFlow` 变成新的耦合中心。
