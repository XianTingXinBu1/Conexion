# Project Audit

本文档记录当前仓库在开发前最需要知道的三类信息：测试系统状态、重复实现点、最臃肿热点。

## 测试系统

当前测试体系已切换为可直接运行的 Vitest 单元测试基线：

- 入口配置：`vitest.config.ts`
- 运行命令：`npm run test:run`
- 当前重点覆盖：
  - `src/modules/system-prompt/**`
  - `src/utils/urlValidator.ts`

此前仓库里的 `example.test.ts`、`validate.test.ts` 属于演示/验证脚本风格，容易和真实测试混淆。现已用断言式测试替代。

## 功能重复 / 重叠实现

### 1. 确认弹窗系统重复

- `src/components/ConfirmDialog.vue`
- `src/components/common/ConfirmDialog.vue`
- `src/composables/useConfirmDialog.ts`

问题：同一类确认交互有两套组件和一套 composable 封装，调用方式不统一。

### 2. 会话管理重复

- `src/composables/useConversations.ts`
- `src/composables/useConversationManager.ts`
- `src/components/ConversationListPage.vue`

问题：会话加载、删除、重命名、持久化分散在两个 composable 和一个页面里，存在多处直接写 `STORAGE_KEYS.CONVERSATIONS`。

### 3. 设置管理重复

- `src/composables/useAppSettings.ts`
- `src/components/SettingsPage.vue`

问题：同一批设置项有 composable 管理，也有页面直接 `getStorage/setStorage` 管理，默认值还出现过不一致。

### 4. 角色数据访问重复

- `src/composables/useCharacters.ts`
- `src/components/RoleManagementPage.vue`
- `src/components/ChatPage.vue`
- `src/components/ConversationListPage.vue`

问题：角色的读取/保存本应走 composable，但页面里仍有直接读写存储的路径。

### 5. 页面壳层 / 模态层复用不一致

- 页头：`src/components/common/PageHeader.vue` vs 自写 header（如 `SettingsPage.vue`）
- 模态：`src/components/common/Modal.vue` vs 各类自写 modal/form modal

问题：同类 UI 责任没有完全收敛到共享组件。

## 最臃肿的区域

### 1. `src/components/ChatPage.vue`

这是当前最重的总控文件，混合了：

- 聊天消息生命周期
- API 流式请求
- 提示词构建
- 正则处理
- token 统计
- 会话持久化
- 多个弹窗与页面状态

这是**最高风险热点**，改动这里最容易产生连锁影响。

### 2. `src/components/ApiPresetPage.vue` + `src/modules/api-preset/useApiPresets.ts`

混合了预设 CRUD、模型加载、连接测试、离开保护、通知与表单状态。

### 3. `src/components/PromptPresetPage.vue`

同时负责预设 CRUD、条目 CRUD、排序、持久化、确认操作。

### 4. `src/components/RoleManagementPage.vue`

同一文件内处理 user / ai 两类角色与相关持久化。

### 5. `src/components/KnowledgeBasePage.vue` + `src/components/knowledge/KnowledgeBaseDetailView.vue`

知识库列表、详情、条目编辑、排序、确认流都耦合较重。

## 开发建议

- 新功能优先找“唯一 owner”后再改，避免继续增加重复实现
- 修改 `ChatPage.vue` 前，先明确只动哪条责任链
- 如果要做整理，优先从“重复实现最多的地方”开始，而不是先重构 UI
