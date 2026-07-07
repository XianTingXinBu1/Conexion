# Project Audit

本文档记录 Conexion 当前项目健康度、已完成的结构治理、仍需关注的风险点和建议优先级。

## 总体结论

当前项目已经完成一轮重要的聊天页收敛：

- `ChatPage.vue` 已经从早期的大型业务页面变成较薄的 View。
- 聊天发送主流程已经进入 `SendMessageUseCase`。
- Prompt 构建已有统一入口。
- 聊天模块已经具备架构边界检查。
- 后端代理已经加入项目，前端请求统一走本地 `/api`。

当前主要风险不再是“ChatPage 单文件过重”，而是：

1. 聊天专属逻辑仍有一部分留在全局 `src/composables`。
2. 非聊天页面仍有较厚页面组件。
3. 部分模块文档和历史蓝图容易与当前状态混淆。
4. 页面级联动测试仍偏少。

## 测试现状

项目已有 Vitest 基线。

常用命令：

```bash
npm run test:run
npm run test:coverage
```

当前覆盖较集中的区域：

- `src/modules/system-prompt/**`
- `src/features/chat/application/**`
- `src/api/stream.ts`
- `src/repositories/**` 的部分存储逻辑
- 部分 composables
- `server/index.ts`

相对薄弱的区域：

- 页面级交互测试
- 路由级集成流程
- API 预设页面完整交互
- 角色 / 知识库 / Prompt 预设页面复杂 CRUD 流程

## 当前架构状态

### 已完成的好变化

- `src/components/ChatPage.vue` 只负责渲染和事件绑定。
- `src/features/chat/presentation/useChatPageViewModel.ts` 成为聊天页 composition root。
- `src/features/chat/application/sendMessage.usecase.ts` 承载发送主流程。
- `src/features/chat/application/buildSystemMessages.usecase.ts` 统一真实发送与预览的 Prompt 构建。
- `src/features/chat/application/streamMessageAssembler.ts` 管理 stream buffer 与 flush。
- `scripts/check-architecture-boundaries.js` 固化聊天边界规则。

### 仍未完全收口的地方

- `src/composables/useChatSendFlow.ts` 是聊天专属适配器，但还位于全局 composables。
- `useChatPageViewModel` 装配依赖较多，后续可继续分组。
- conversation / regex / prompt / knowledge / character 还未全部迁入 feature 目录。

## 重复实现 / 责任重叠

### 1. 确认弹窗系统

涉及：

```txt
src/components/ConfirmDialog.vue
src/components/common/ConfirmDialog.vue
src/composables/useConfirmDialog.ts
```

问题：

同一类确认交互存在两套组件和一套 composable，调用方式不统一。

建议：

- 明确一个组件作为唯一默认实现。
- 旧组件逐步迁移或删除。

### 2. 会话管理

涉及：

```txt
src/composables/useConversations.ts
src/composables/useConversationManager.ts
src/services/conversationRepository.ts
src/features/chat/presentation/useChatSessionFacade.ts
src/components/ConversationListPage.vue
```

现状：

聊天页已有 facade，但会话相关 owner 在 composable、service、页面之间仍需继续收口。

建议：

- 短期保持现有行为稳定。
- 中期抽清楚 conversation repository / usecase / presentation adapter。

### 3. API 预设

涉及：

```txt
src/components/ApiPresetPage.vue
src/modules/api-preset/useApiPresets.ts
src/repositories/apiPresetRepository.ts
src/api/models.ts
```

现状：

功能可用，但页面和 composable 混合了：

- 预设 CRUD
- 表单状态
- 模型加载
- 连接测试
- 页面离开保护
- 通知

建议：

按“页面 View -> composable/controller -> repository/api”的方向继续拆。

### 4. 设置管理

涉及：

```txt
src/composables/useAppSettings.ts
src/components/SettingsPage.vue
src/components/settings/*
```

问题：

设置项 owner 基本集中，但随着设置增多，需要避免页面直接承载复杂规则。

### 5. 横切 UI

涉及：

```txt
src/components/common/PageHeader.vue
src/components/common/Modal.vue
src/components/common/ConfirmDialog.vue
各页面自己的 header / modal 写法
```

建议：

后续统一页面壳层和弹窗组合方式，减少重复样式和重复交互。

## 当前热点文件

### 1. `src/features/chat/presentation/useChatPageViewModel.ts`

它是当前聊天页装配中心。

风险：

- 依赖较多。
- 容易继续膨胀。

建议：

- 保持只做组合，不写业务规则。
- 如果继续增长，按 feature controller 分组输出。

### 2. `src/composables/useChatSendFlow.ts`

它是 Vue adapter，负责连接 `SendMessageUseCase` 与页面状态。

风险：

- 聊天专属逻辑仍放在全局 composables。

建议：

- 后续可迁入 `src/features/chat/presentation/`。
- 保持它只做适配，不回流业务流程。

### 3. `src/components/ApiPresetPage.vue`

仍是比较厚的页面。

建议：

- 继续拆模型加载、连接测试、表单状态。

### 4. `src/components/PromptPresetPage.vue`

负责预设 CRUD、条目 CRUD、排序、持久化、确认操作。

建议：

- 后续可拆 controller 或 feature presentation。

### 5. `src/components/RoleManagementPage.vue`

一个页面同时处理 user / ai 两类角色和相关持久化。

建议：

- 继续复用 role 子组件。
- 抽离数据操作和确认流。

### 6. `src/components/KnowledgeBasePage.vue`

列表、详情、条目编辑、排序、确认流都集中在知识库页面体系中。

建议：

- 保持列表 / 详情组件边界。
- 后续把复杂操作抽到 composable/controller。

## 文档状态

当前正式文档已经整理为：

```txt
README.md

docs/chat-architecture.md
docs/project-audit.md
docs/chatpage-refactor-blueprint.md
docs/chat-coupling-permanent-refactor-plan.txt

src/modules/api-preset/README.md
src/modules/debug/README.md
src/modules/markdown/README.md
src/modules/notification/README.md
src/modules/system-prompt/README.md
src/modules/system-prompt/USAGE.md
src/modules/system-prompt/SUMMARY.md
```

历史文档已统一更新为当前状态，不再描述旧的 560+ 行 `ChatPage.vue`。

## 建议优先级

### P0：保持健康检查稳定

每次较大改动后运行：

```bash
npm run test:run
npm run check:architecture
npm run build
```

提交前运行：

```bash
npm run health-check
```

### P1：继续收口聊天适配层

- 评估 `useChatSendFlow` 是否迁到 `features/chat/presentation`。
- 避免 `useChatPageViewModel` 膨胀成新总控。

### P2：整理 API 预设页面

- 模型加载和连接测试拆出。
- 表单状态和预设 CRUD 分离。

### P3：统一确认弹窗 / Modal / PageHeader

- 明确通用 UI 唯一入口。
- 降低页面重复实现。

### P4：提升页面级测试

优先补：

- 发送消息关键路径
- API 预设保存 / 切换 / 测试连接
- Prompt 预设编辑
- 知识库条目启用与排序

## 一句话总结

Conexion 当前已经从“聊天页重、业务散”进入“聊天核心较清晰、页面和横切 UI 仍需继续收口”的阶段。后续更适合小步治理，而不是大拆大改。
