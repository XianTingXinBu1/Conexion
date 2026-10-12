# Project Status

本文档是 Conexion 的**单一事实来源**：当前状态、工程约定、已知风险、后续路线。
它合并了原先分散在 `project-audit.md`、`chatpage-refactor-blueprint.md`、
`chat-coupling-permanent-refactor-plan.txt` 三份文档中的内容——三者此前在
「已完成清单 / 边界规则 / 待办优先级 / 验证命令」上互相重复，且各有一套
冲突的优先级编号。

> 文档同步状态：最后校对 2026-10-12（校正质量基线数字、补记角色卡编辑器 /
> 开场白 / 返回键接管 / 聊天内容处理管线，为 chat-prompt 与
> conversation-compression 补上 module README，并补上 ApiPresetPage 页面级测试）。

相关文档：

```txt
README.md                       项目入口与运行方式（英文主文档）
README.zh-CN.md                 中文版，与主文档内容对等
```

其他：

```txt
docs/chat-architecture.md       聊天模块分层与边界规则（聊天相关细节看它）
docs/backend-api.txt            后端 API 契约
e2e/README.md                   E2E 用例编写方式与运行命令
src/modules/<name>/README.md    各 module 的独立说明（8 个 module 已全部补齐）
```

> 两份 README 内容对等，改一份就要同步另一份（结构、命令表、配置表、机制说明都要一致）。

---

## 一、当前状态

技术栈：Vue 3 + TypeScript + Vite 前端，内建 Hono 后端代理，运行时数据写入
后端 JSON 文件（`.runtime/data/`），前端不做业务持久化。

质量基线：

```bash
npx vitest run                 # 47 文件 / 305 测试
npm run check:architecture     # 179 文件扫描
npx vue-tsc -b                 # 类型检查
npm run build                  # 构建
npm run e2e                    # E2E（需服务在线）
npm run health-check           # 提交前的完整检查（6 项，约 65s）
```

已完成的结构治理（细节见 git log，此处仅作索引）：

- `ChatPage.vue` 为薄 View，发送主流程进入 `SendMessageUseCase`
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
- 提示词宏变量替换（`src/modules/system-prompt/core/macro.ts`）：变量表 `MACRO_DEFINITIONS` 单一真源，
  取值表 / `SUPPORTED_MACROS` / 表单 chips 均由其派生；宏只作用于作者提示词文本，
  槽位注入的运行时数据（角色字段、知识库正文等）按原样写入，不做二次展开
- 聊天内容处理管线（`src/features/chat/application/chatContentPipeline.ts`）：
  原文 → before-macro 规则 → 宏展开（跳过代码块与行内代码）→ after-macro 规则 → 落库，
  让正则的「应用时机」真正生效；用户输入与 AI 输出共用一条管线，
  每回合固定 `now`，展开结果直接落库保持展示 / 存储 / 上游一致
- token 计数统一走 `@/utils/tokenCounter`（gpt-tokenizer cl100k），废除按字符折算的估算
- Markdown 清理改为按标签维度的属性白名单，修复行内代码被当作 HTML 解析
- Markdown 支持 `<details>/<summary>` 折叠块与 `kbd` / `mark` / `sub` / `sup` / `abbr` 等语义标签
- Markdown 脚注（`[^1]` + `[^1]: 内容`）改为上标标记 + 文末列表，不再生成指向相对路径的错误链接
- 支持 KaTeX 数学公式（`$...$` / `$$...$$`，用占位符在 sanitize 后回填，不放宽白名单）
- 引入 Selenium E2E（Termux 无可用 Playwright 二进制，复用系统 Chromium + chromedriver），
  用例已扩展到 8 个文件 / 14 个用例，新增聊天操作布局与条件跟随滚动验证
- chromedriver 路径自动探测，E2E 在 Debian / Ubuntu 上也可运行
- 覆盖层接管 Android 系统返回键（`useBackGuard`）：有弹窗或二级页时先关它们，
  而不是直接离开聊天页
- 角色卡模块（`src/modules/character-card/`）：SillyTavern v1 / v2 导入导出 + 本应用备份，
  角色卡编辑器与开场白（`firstMessage` / `alternateGreetings`）
- 移除常驻的手动压缩提示条：压缩入口回到 Token 面板，提示条只在达到阈值时出现
- 聊天末尾 AI 回复支持重新生成，保留多个回复版本；按钮 / 横向滑动切换后保存，
  下一轮请求使用选中的版本。生成或压缩期间禁止切换；取消且没有内容时恢复原版本，
  已有部分内容时保留新版本。角色开场白没有用户指令时不显示重试入口。
- 上下文阈值等待 API 预设及选中项加载完成后再判断，避免历史先加载时按临时
  2,048 token 上限弹出 100% 误报；通知标明本地估算及预设上限。
- 消息操作移至正文下方，版本箭头分居两端；仅在用户停留底部时跟随输出，
  聚焦 / 发送不强制跳转，回到底部自动恢复。
- 角色新建弹窗整合空白创建与导入角色卡，和编辑器共用返回键守卫；列表统一
  72px 高度，展示名称与已有作者 / 版本。提示词条目描述改为选填（新建 / 编辑）。
- 完善消息编辑 / 删除：保存成功再关编辑弹窗，失败保留草稿并展示原因；
  空白内容禁止保存，临时会话可在本地编辑 / 删除，生成或压缩期间禁用入口。
  编辑只影响当前回复版本；点击删除进入多选，默认选中当前及后续消息，确认后逐条删除。
  中途失败保留尚未删除消息的选择状态，已成功删除的消息不回滚。
- 原生思考内容支持流式 `reasoning_content` / `reasoning` 字段，独立于正文保存并折叠展示，
  随回复版本切换；API 预设中的「显示思考内容」开关默认开启，仅控制展示。
  当前不解析正文中的 `<think>` 标签，也未进行真实上游模型联调。
- 首个非聊天页的页面级测试：`ApiPresetPage.test.ts`（保存 / 切换预设 / 测试连接 / 获取模型列表）
- 本次提交检查：全量单测 305 项及构建、架构边界检查通过；上下文统计、回复版本、
  删除多选的独立提交快照均通过构建和全量单测。返回保护、聊天布局滚动及新建会话
  E2E 已通过；全量 E2E 运行中 ChromeDriver 提前退出，未完成全部用例。

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

1. **`src/features/chat/presentation/useChatPageViewModel.ts`**（331 行）
   聊天页装配中心，22 个 import。可以承担组合职责，但不要在里面积累业务规则；
   继续增长时应按「数据源初始化 / 控制器组装 / UI 状态导出」拆分。
2. **会话领域 owner 未完全收口**。能力仍分布在 `useConversations`、
   `useConversationManager`、`services/conversationRepository`、
   `useChatSessionFacade`、`ConversationListPage` 之间。
3. **页面与大组件仍偏厚**：`PromptPreviewModal.vue` 731 行、`TokenDetailsPanel.vue`
   702 行、`ApiPresetPage.vue` 540 行；`PromptItemCard.vue` 505、`MainPage.vue` 490、
   `CharacterEditor.vue` 487、`KnowledgeBaseDetailView.vue` 471、
   `ConversationListPage.vue` 433、`PromptPresetPage.vue` 398。
   聊天页主体已经瘦下来（`ChatPage.vue` 204 行），厚度转移到了聊天侧的大组件上。
4. **页面级测试仍然偏少**。页面级单测只有 `ChatPage.sendFlow.test.ts`（成功 / 取消 /
   失败 / 预设加载期取消 / 重试与版本切换 / 重试期间切换保护 / 重试取消恢复）与 `ApiPresetPage.test.ts`（保存 / 切换预设 / 测试连接 /
   获取模型列表），其余页面仍无页面级测试；E2E 目前 8 个文件 / 14 个用例（含聊天布局 / 条件跟随滚动 /
   新建角色弹窗与编辑器返回键），覆盖冒烟、
   两处渲染与两处交互，还没形成页面回归网。
5. **横切 UI 尚未完全收口**。`ConfirmDialog`（10 处）与 `Modal`（8 个文件）已是事实上
   的唯一入口；`PromptPreviewModal.vue` 仍自带一套遮罩实现，`PageHeader` /
   `EmptyState` 的用法在各页面间也不一致。

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
  按真实节距算落点，固定高度会让落点跳格（测量函数要给**最后一项**补上列表 gap，
  否则末尾落点少一个间距）；触摸路径要一并处理 `touchcancel`，
  否则浏览器接管手势后 `isDragging` 与偏移量会停在拖拽态。
  让位位移要取**被拖项**的节距（`resolvePitch(fromIndex)`）：各让各的节距会让
  高度不一的列表错位（高卡片的邻居被挤飞）；`getItemStyle` 的 `transition` 必须
  **常驻**（只有被拖项是 `none`），偏移归零时摘掉整条 inline style 会让让位复位与
  松手吸附瞬跳；松手吸附依赖“顺序变化与初始位移同帧、下一帧再放开过渡”，
  不要在放开前清偏移。鼠标（HTML5 DnD）与触摸共用同一套几何：`dragover` 的
  `clientY` 驱动让位与插入指示（鼠标路径拖动项**不跟手**，由浏览器拖影负责），
  `drop` 的落点以插入指示为准而不是“落在哪个元素上”；拖动中的插入位置要存成 ref
  （手势坐标是普通变量，computed 读不到它的变化）。插入指示只改 `border-color` /
  `box-shadow`，改 `border-width` 会改变卡片高度并把下方内容挤动。
  长列表的**边缘自动滚动**：指针进滚动容器上下 72px 内就每帧滚，滚动量要补偿进
  手势位移（否则卡片不跟手）；滚动范围必须钳制在手势开始时的 `maxScroll`——
  拖动项的 translate 会把内容掸出容器、掸大 `scrollHeight`，不钳制就是“掸出→又能滚”
  的正反馈无限滚；自动滚动帧里不能再调 `syncAutoScroll`（会排第二个循环指数级跑飞）。
- **代理参数一律透传**：`/api/chat/completions` 不再维护逐字段白名单，除 `baseURL` /
  `apiKey` 两个本地专用字段外全部转发给上游。曾经的白名单会把前端新加的 [OI] 参数
  （`top_p`、`stop`、`stream_options` …）静默丢掉，表现为「参数传了但没效果」。
  新增参数只需改前端，不要再把白名单加回来。
- **流式 usage 必须显式请求**：`stream_options.include_usage` 由 `ChatApi.buildRequestBody`
  在 `stream: true` 时自动带上。不传时上游可自行决定是否在末尾 chunk 带 usage，
  Token 面板的真实用量会时有时无。
- **采样参数有值才发 vs 总是发**：`temperature` / `max_tokens` / `top_p` /
  `frequency_penalty` / `presence_penalty` 总是发送（未配置发 [OI] 默认值），
  但 `stop` 仅在非空时发送、`seed` 仅在设置时发送。原因不是洁癖：空的 `stop: []`
  部分上游会直接 400；而 `seed: 0` 是「固定种子」而不是「不设置」，总是发会让
  本来应该每次不同的输出变得可复现。改 `buildRequestBody` 时别把这两条改成无条件发送。
- **停止序列在 UI 里是「一行一条 + 转义」**：文本框一行一条，但支持 `\n` / `\t` / `\\`
  转义，因为聊天模型最常用的停止序列恰是 `"\n\n"` 和 `"\n\nUser:"`，而一行一条的
  输入框打不出真换行。转换规则集中在 `src/modules/api-preset/stopSequences.ts`
  （`parseStopSequences` / `formatStopSequences`），组件只负责接线。
  注意：这里**故意不 trim**，序列里的空白可能是有意义的。
- **上下文窗口上限的唯一来源是 `Preset.contextLength`**。早期同一个概念同时存在
  `maxTokens` 与 `contextLength`，`useChatStats` 又写成 `contextLength || maxTokens`，
  于是「最大上下文 Tokens」滑块（绑的是 `maxTokens`）一旦被 `contextLength` 遮蔽，
  就变成改不动的死控件。现已删除 `maxTokens`，滑块直接绑 `contextLength`。
  旧数据由后端读写路径归一（`server/repositories/presetRepositories.ts` 的
  `normalizeApiPreset` / `resolveContextLength`）：只有 `maxTokens` 的旧预设会迁移到
  `contextLength`，两者同时存在时以 `contextLength` 为准。不要再引入第三个同义字段。
- **预设状态的消费方**：`useApiPresets()` 每次调用都是独立实例，`currentPreset`
  只有在 `loadPresets()`（会一并同步后端记住的选中项）之后才有意义。请求参数走
  `repositories/apiPresetRepository.loadCurrentApiPreset()` 直接读设置，统计展示
  走 composable 的 `currentPreset`，两条路径必须指向同一个预设，否则会出现
  「改了预设但上下文上限/使用率不变」。
- **token 计数口径**：当前上下文通过 `features/chat/application/contextTokens.ts`
  统一解析。模型、服务地址与完整输入前缀匹配时，以 API `prompt_tokens` 为基准，
  新增消息用 `@/utils/tokenCounter` 估算；输入被编辑 / 删除 / 压缩或配置改变时
  回退完整本地估算。不得将 `completion_tokens` 或 `total_tokens` 直接当成上下文。
  圆环、详情、提醒与自动压缩共用解析器，自动压缩预测使用完整构建后的提示词。
  API 基准仅保存在当前页面内存，刷新后回退估算；聊天 / 压缩用量通过独立实例隔离。
  本地估算仍统一使用 gpt-tokenizer；上限由预设 `contextLength` 提供，不预留输出额度。
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

### P1：补页面级测试（进行中）

理由：单测层面的页面级链路很少，任何页面重构都缺乏安全网。工具链
（`@testing-library/vue` + happy-dom）与 E2E 骨架（Selenium）均已就绪，可直接复用。

已完成：`src/components/__tests__/ApiPresetPage.test.ts`——保存 / 切换预设 /
测试连接（含成功、失败与「测试中」窗口）/ 获取模型列表，5 个用例，只在 fetch
边界打桩。

待补：Prompt 预设编辑，知识库条目启用与排序。

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

### P5：补齐缺失的 module README ✅ 已完成（2026-10-12）

`chat-prompt`、`conversation-compression` 的 README 已补齐，8 个 module 均有独立说明。

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
