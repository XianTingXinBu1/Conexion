# Project Status

本文档是 Conexion 的**单一事实来源**：当前状态、工程约定、已知风险、后续路线。
它合并了原先分散在 `project-audit.md`、`chatpage-refactor-blueprint.md`、
`chat-coupling-permanent-refactor-plan.txt` 三份文档中的内容——三者此前在
「已完成清单 / 边界规则 / 待办优先级 / 验证命令」上互相重复，且各有一套
冲突的优先级编号。

> 文档同步状态：最后校对 2026-09-25（提示词宏变量、token 计数口径统一、
> Markdown 属性白名单与 KaTeX 公式、Selenium E2E 落地之后）。

相关文档：

```txt
README.md                       项目入口与运行方式
docs/chat-architecture.md       聊天模块分层与边界规则（聊天相关细节看它）
docs/backend-api.txt            后端 API 契约
e2e/README.md                   E2E 用例编写方式与运行命令
src/modules/<name>/README.md    各 module 的独立说明（缺 chat-prompt、conversation-compression）
```

---

## 一、当前状态

技术栈：Vue 3 + TypeScript + Vite 前端，内建 Hono 后端代理，运行时数据写入
后端 JSON 文件（`.runtime/data/`），前端不做业务持久化。

质量基线：

```bash
npx vitest run                 # 31 文件 / 153 测试
npm run check:architecture     # 167 文件扫描
npx vue-tsc -b                 # 类型检查
npm run build                  # 构建
npm run e2e                    # E2E（需服务在线）
npm run health-check           # 提交前的完整检查（6 项，约 65s）
```

已完成的结构治理（细节见 git log，此处仅作索引）：

- `ChatPage.vue` 瘦身为薄 View（220 行），发送主流程进入 `SendMessageUseCase`
- 提示词适配收口到 `src/modules/chat-prompt/`
- 会话压缩收口到 `src/modules/conversation-compression/`
- 确认弹窗统一为 `components/common/ConfirmDialog.vue` 单一实现
- 聊天专属 composable（8 个）全部迁入 `src/features/chat/presentation/`，
  `src/composables/` 只剩跨页面通用能力
- API 层错误类型与错误体解析统一（`src/api/errors.ts`）
- 超时原语统一（`src/api/transport.ts`），本地数据请求获得超时保护
- 上游重试策略收拢到后端代理，按请求是否幂等决定
- 支持取消进行中的非流式请求（会话压缩）
- 移除前端遗留的浏览器存储清理机制与相关依赖
- 提示词宏变量替换（`src/modules/system-prompt/core/macro.ts`，表单侧带变量 chips）
- token 计数统一走 `@/utils/tokenCounter`（gpt-tokenizer cl100k），废除按字符折算的估算
- Markdown 清理改为按标签维度的属性白名单，修复行内代码被当作 HTML 解析
- Markdown 支持 `<details>/<summary>` 折叠块与 `kbd` / `mark` / `sub` / `sup` / `abbr` 等语义标签
- Markdown 脚注（`[^1]` + `[^1]: 内容`）改为上标标记 + 文末列表，不再生成指向相对路径的错误链接
- 支持 KaTeX 数学公式（`$...$` / `$$...$$`，用占位符在 sanitize 后回填，不放宽白名单）
- 引入 Selenium E2E（Termux 无可用 Playwright 二进制，复用系统 Chromium + chromedriver）

---

## 二、工程约定

### 目录职责

```txt
src/modules/           相对独立的域模块
  system-prompt/         纯构建引擎（不依赖 Vue / UI）
  chat-prompt/           聊天侧提示词适配
  conversation-compression/  压缩核心 + 控制器 + UI
src/features/chat/     聊天 feature
  application/           usecase（不依赖 Vue / UI）
  presentation/          ViewModel / Controller / Vue adapter / composable
src/composables/       仅跨页面通用能力
src/repositories/      后端数据读写入口
src/services/          仍存在的服务层（会话）
src/api/               传输层：http.ts（本地数据）、base/chat/models（上游代理）、
                       errors.ts（错误）、transport.ts（超时/取消）
server/                内建后端代理
```

### 分层

```txt
View -> ViewModel -> Controller/Facade -> UseCase -> Repository/Gateway -> Storage/API
```

### 样式

- 全局共享样式（`src/styles/common.css`：`.page` / `.section` / `.card` / `.btn`
  / `.modal-btn` / `.dropdown` / `.tabs-container` 等）**只能由 `src/main.ts`
  引入**。页面组件一律懒加载，把全局样式挂在某个页面上会导致其他页面从深链接
  直接进入时样式整体失效（而且只在「先访问过那个页面」时才会碰巧正常）。
- 页面私有样式（`src/styles/chat.css` 等）由对应页面引入；组件样式就近写在
  `<style scoped>` 里，不要再往 `common.css` 里塞单页专用类。

### 错误处理

- 带 HTTP 状态的失败抛 `ApiRequestError`，携带 `status` 与 `serverMessage`
- 超时抛 `ApiTimeoutError`；用户取消以 `REQUEST_CANCELLED_MESSAGE` 表示
- **语义判断读 `error.serverMessage` 或 `error.status`，不要对 `error.message`
  做字符串比较**（展示文案可能变化）
- 本地数据接口与上游代理的错误文案语境不同，刻意不统一

### 网络行为

- 重试只由后端代理承担，且只重试幂等请求（GET/HEAD）；POST 一律不重试
- 本地数据请求超时 15s（`LOCAL_REQUEST_TIMEOUT_MS`）
- 上游请求超时由 `UPSTREAM_TIMEOUT_MS` 控制，默认 60s

### 验证策略

小改动：

```bash
npx vitest run
npm run check:architecture
```

涉及类型 / 构建：

```bash
npm run build
```

涉及渲染 / 浏览器行为：

```bash
sh scripts/dev/manage.sh start   # E2E 需要服务在线
npm run e2e                      # 全部用例；npm run e2e macro 按名字过滤
```

提交前：

```bash
npm run health-check
```

E2E 在健康检查中标记为**非关键项**（`critical: false`），失败只告警不阻断；
但改动 Markdown 清理、宏变量、路由时仍应手动确认 E2E 通过。

无法跑完整验证时，至少说明：跑了什么、没跑什么、剩余风险。

---

## 三、边界规则

聊天模块的详细边界规则（六条）与命令见 `docs/chat-architecture.md`，由
`scripts/check-architecture-boundaries.js` 强制，此处不重复列出。

写路径类规则时请用 `banned: true`（按文件位置判定），不要用
`forbidden: [/.*/]`——后者匹配的是 import 说明符，一个不含任何 import 的文件
可以绕过检查。

---

## 四、已知风险与热点

按「改动时的痛感」排序：

1. **`src/features/chat/presentation/useChatPageViewModel.ts`**（约 290 行）
   聊天页装配中心，16 个 import。可以承担组合职责，但不要在里面积累业务规则；
   继续增长时应按「数据源初始化 / 控制器组装 / UI 状态导出」拆分。
2. **会话领域 owner 未完全收口**。能力仍分布在 `useConversations`、
   `useConversationManager`、`services/conversationRepository`、
   `useChatSessionFacade`、`ConversationListPage` 之间。
3. **页面与大组件仍偏厚**：`PromptPreviewModal.vue` 724 行、`TokenDetailsPanel.vue`
   699 行、`ApiPresetPage.vue` 521 行；`MainPage.vue` 490、`KnowledgeBaseDetailView.vue`
   467、`ConversationListPage.vue` 433、`PromptPresetPage.vue` 398。
   聊天页主体已经瘦下来（`ChatPage.vue` 219 行），厚度转移到了聊天侧的大组件上。
4. **页面级测试仍然偏少**。单测里只有 `ChatPage.sendFlow.test.ts` 一条页面级链路
   （成功 / 取消 / 失败 / 预设加载期取消），其余页面无页面级测试；E2E 目前 4 个
   用例（smoke / macro / macro-replacement / markdown-render），只覆盖冒烟与两处
   特定渲染，还没形成页面回归网。
5. **横切 UI 尚未完全收口**。`ConfirmDialog`（10 处）与 `Modal`（8 处）已是事实上的
   唯一入口；`PromptPreviewModal.vue` 仍自带一套遮罩实现，`PageHeader` /
   `EmptyState` 的用法在各页面间也不一致。
6. `src/modules/chat-prompt` 与 `src/modules/conversation-compression` 尚无独立
   README（`api-preset` / `debug` / `markdown` / `notification` / `system-prompt`
   都已经有）。

### 需要注意的行为边界

- **stream 与 regex**：用户输入 regex 在 `SendMessageUseCase` 中处理，assistant
  stream 内容由 `StreamMessageAssembler` 累积与 flush。assistant regex 应保持
  幂等；结构重构时不要混入 regex 行为变更。
- **自动压缩时机**：由 `SendMessageUseCase` 在发送前后判断。压缩失败应中止发送
  并提示；压缩摘要参与 Prompt 构建；不要出现 UI controller 与 usecase 各判断
  一套规则的情况。
- **列表排序（`useDraggable`）**：列表必须是**可写**的 ref。传 props 派生的 computed
  进去时 `items.value = newItems` 只会被 Vue 警告后忽略（computed 只读），表现为
  “能拖、有动画、顺序不生效”；列表项高度不固定时必须传 `measureItemHeights`
  按真实节距算落点，固定高度会让落点跳格；触摸路径要一并处理 `touchcancel`，
  否则浏览器接管手势后 `isDragging` 与偏移量会停在拖拽态。
- **预设状态的消费方**：`useApiPresets()` 每次调用都是独立实例，`currentPreset`
  只有在 `loadPresets()`（会一并同步后端记住的选中项）之后才有意义。请求参数走
  `repositories/apiPresetRepository.loadCurrentApiPreset()` 直接读设置，统计展示
  走 composable 的 `currentPreset`，两条路径必须指向同一个预设，否则会出现
  「改了预设但上下文上限/使用率不变」。
- **token 计数口径**：长度与 token 一律走 `@/utils/tokenCounter`（gpt-tokenizer
  cl100k）。`system-prompt` 曾用「字符数 × 0.25」估算，这是英文经验值，对中文
  低估 3~4 倍（已删除 `TOKEN_ESTIMATION_RATIO`）。预览用量、上下文上限、压缩
  阈值必须同一口径，不要引入第三套估算。
- **Markdown 安全断言的位置**：sanitizer 用的是按标签维度的属性白名单。
  DOMPurify 在 happy-dom 下无法真正清理（原生 `sanitize('<p>x</p>')` 只返回
  `x`，显式传 `ALLOWED_TAGS` 也一样），所以 **DOM 级断言在单测里是假阳性，
  必须放到 E2E**（`e2e/cases/markdown-render.mjs`）；纯字符串层面的
  `marked.render()` 输出在单测里测仍然可靠。
- **数学公式的回填顺序**：KaTeX 输出依赖大量 inline style，必须在 sanitize
  **之后**回填（`src/modules/markdown/math.ts` 的占位符方案）。若把回填放进
  `afterRender` 这类清洗前的钩子，公式样式会被属性白名单删干净导致排版崩；
  也不要为了公式放宽 sanitizer 白名单。

---

## 五、后续路线

**单一优先级列表**（三份旧文档中的 P0–P4 / P1–P5 / 四阶段已合并到此处）：

### P1：补页面级测试

理由：单测层面仍只有一条发送链路用例，任何页面重构都缺乏安全网。工具链
（`@testing-library/vue` + happy-dom）与 E2E 骨架（Selenium）均已就绪，可直接复用。

优先补：API 预设保存 / 切换 / 测试连接，Prompt 预设编辑，知识库条目启用与排序。

注意：涉及 DOM 清理 / XSS 的断言不要写在 happy-dom 单测里，理由见「需要注意的
行为边界」。

### P2：会话领域收口

抽出 conversation application usecases，明确 conversation repository 的唯一
owner，让聊天页与会话列表页复用同一套会话能力。

### P3：整理 API 预设页面

按「页面 View → controller → repository/api」拆分：预设 CRUD、表单状态、
模型加载、连接测试、页面离开保护、通知。

### P4：统一横切 UI

明确 `Modal` / `PageHeader` / `EmptyState` 的唯一入口，减少页面重复实现。

### P5：补齐缺失的 module README

`chat-prompt`、`conversation-compression`。

### 长期目标目录方向

不要求一次迁完，按实际收益小步推进：

```txt
src/
  app/          providers / router
  shared/       ui / lib / types
  entities/     message / conversation / character / knowledge-base / ...
  features/     chat / conversation / prompt / regex / knowledge-base / ...
                （各自 application / infrastructure / presentation）
```

原则：不为目录漂亮而空迁移；每次迁移保持行为不变；每次迁移都有最小验证命令。

---

## 六、不建议做的事

- 不建议一口气把整个项目迁入 feature sliced 目录
- 不建议在迁文件时顺手改发送、压缩、regex 行为
- 不建议为了减少行数拆出无语义的 `utils`
- 不建议让 usecase 直接调用 notification、router 或 DOM scroll
- 不建议在页面重新直接访问 storage / constants
- 不建议复制一套已有 repository / API client
- 不建议把 TODO 当成核心功能依赖
- 不建议在 usecase 与 UI controller 中各自实现同一套业务判断

---

## 一句话总结

Conexion 已经走完「聊天页重、业务散」阶段：聊天核心分层清晰、边界由脚本固化、
API 传输层与错误语义统一，验证侧也补齐了 Selenium E2E 骨架（但页面级单测仍是空白）。
当前重点转向**页面级测试覆盖**与**横切 UI / 会话领域
的收口**，并继续保持小步治理、每步可验证的节奏。
