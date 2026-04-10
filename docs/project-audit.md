# Project Audit

这份文档只回答三件事：

1. 现在测试大概到哪了
2. 代码里哪些地方有重复实现
3. 哪些文件最容易越改越乱

---

## 测试现状

项目现在已经有一套能直接跑的 Vitest 基线。

- 配置入口：`vitest.config.ts`
- 常用命令：`npm run test:run`
- 当前覆盖更偏向逻辑层，而不是完整页面流程

目前相对更有覆盖的区域主要是：

- `src/modules/system-prompt/**`
- `src/utils/urlValidator.ts`
- 一部分 composables / storage / notification 相关逻辑

换句话说：
**纯逻辑模块比页面主流程更稳，页面级联动测试还不算多。**

---

## 重复实现 / 责任重叠

### 1. 确认弹窗系统

涉及：

- `src/components/ConfirmDialog.vue`
- `src/components/common/ConfirmDialog.vue`
- `src/composables/useConfirmDialog.ts`

问题：
同一类确认交互存在两套组件和一套 composable，调用方式不统一。

---

### 2. 会话管理

涉及：

- `src/composables/useConversations.ts`
- `src/composables/useConversationManager.ts`
- `src/services/conversationRepository.ts`
- `src/components/ConversationListPage.vue`

现在比之前已经收敛了一步：
底层存储访问已经统一到了 `conversationRepository`。

但页面层和 composable 层的 owner 还没有完全收干净，后面如果继续整理，会话相关仍然是值得持续收口的一块。

---

### 3. 设置管理

涉及：

- `src/composables/useAppSettings.ts`
- `src/components/SettingsPage.vue`

问题：
默认值和页面行为已经比之前更集中，但设置项的真正唯一 owner 还不算彻底明确。

---

### 4. 角色数据访问

涉及：

- `src/composables/useCharacters.ts`
- `src/components/RoleManagementPage.vue`
- `src/components/ChatPage.vue`
- `src/components/ConversationListPage.vue`

问题：
角色数据本来应该尽量走 composable，但页面里仍然有直接读取或装配的逻辑。

---

### 5. 页面壳层 / 模态层复用

涉及：

- `src/components/common/PageHeader.vue`
- `src/components/common/Modal.vue`
- 各页面自己的 header / modal 写法

问题：
同类 UI 抽象还不够一致，所以一些页面看起来像在重复造轮子。

---

## 当前最重的几个地方

### 1. `src/components/ChatPage.vue`

这是当前最明显的热点。

它现在虽然已经从大约 650+ 行收到了 560+ 行，抽出了：

- `useChatViewport`
- `useChatStats`

但它仍然承担很多事：

- 页面入口和初始化
- 会话装配
- Prompt 预览与构建
- 消息发送主流程
- regex 处理
- streaming 更新
- 编辑 / 删除消息交互

简单说：
**它已经比之前轻一点，但还是聊天页总控。**

---

### 2. `src/components/ApiPresetPage.vue` + `src/modules/api-preset/useApiPresets.ts`

这一块已经做过一轮低风险收口，默认值和表单初始化逻辑比之前干净了一些。

但它仍然混着：

- 预设 CRUD
- 表单状态
- 模型加载
- 测试连接
- 页面离开保护
- 通知

所以它还是热点，只是危险程度略低于 `ChatPage.vue`。

---

### 3. `src/components/PromptPresetPage.vue`

负责预设 CRUD、条目 CRUD、排序、持久化、确认操作，边界依然比较厚。

---

### 4. `src/components/RoleManagementPage.vue`

一个页面里同时处理 user / ai 两类角色和相关持久化，复杂度不算低。

---

### 5. `src/components/KnowledgeBasePage.vue` + `src/components/knowledge/KnowledgeBaseDetailView.vue`

列表、详情、条目编辑、排序、确认流都耦得比较紧。

---

## 当前可以怎么理解这个仓库

如果只用一句话概括：

**底层逻辑在慢慢变清楚，页面层尤其是聊天页，还是主要复杂度来源。**

现在这个项目不是不能继续迭代，而是更适合按“先收口，再扩功能”的方式推进。

---

## 建议顺序

如果继续整理，优先级大概可以这样看：

1. 继续拆 `ChatPage.vue`
2. 收会话 owner
3. 再看 API preset / settings / prompt preset 这些页面热点
4. 最后再统一一些横切 UI（比如 confirm dialog / modal / page header）
