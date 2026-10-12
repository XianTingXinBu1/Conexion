# Conexion

[English](./README.md) | **简体中文**

Conexion 是一个移动端优先的 LLM 聊天角色扮演应用，支持 OpenAI 兼容接口。

项目包含：

- 前端 Vue 3 + TypeScript + Vite
- 后端 Node.js 转发上游请求与 JSON 持久化

## 快速开始

```bash
npm install
cp .env.example .env              # 修改上游地址、端口、数据目录
sh scripts/dev/manage.sh start    # 同时拉起前后端，并等待健康检查通过
```

浏览器访问 `http://127.0.0.1:3100`。

`manage.sh` 的其余命令：

```bash
sh scripts/dev/manage.sh restart   # 重启
sh scripts/dev/manage.sh status    # 状态 / 端口 / 日志路径
sh scripts/dev/manage.sh logs      # 跟随日志，可加 frontend / backend
sh scripts/dev/manage.sh stop      # 停止
```

pid 与日志写在 `.runtime/`（`pids/`、`logs/`）。两个进程都以独立进程组启动、整组终止：
`npm run dev:server` 会派生 `sh -c` → `tsx` → `node`，只终止 npm 的 pid 会留下孤儿进程继续占用端口。
启动前脚本会回收占着 3100 / 3900 的**本项目**遗留进程；若端口被其他进程占用则报错退出。

## 配置

| 环境变量 | 默认值 | 说明 |
|---|---|---|
| `HOST` | `127.0.0.1` | 后端代理监听地址 |
| `PORT` | `3900` | 后端代理端口 |
| `CLIENT_ORIGIN` | `http://127.0.0.1:3100` | 允许跨域的前端地址 |
| `DEFAULT_UPSTREAM_BASE_URL` | 空 | 默认上游 OpenAI 兼容地址 |
| `DEFAULT_UPSTREAM_API_KEY` | 空 | 默认上游 API Key |
| `ALLOW_PRIVATE_UPSTREAMS` | 空 | 是否允许访问本机 / 内网上游 |
| `MAX_BODY_BYTES` | `1048576` | 请求体上限（1 MiB） |
| `CONEXION_DATA_DIR` | `.runtime/data` | 数据文件目录 |

## 数据存储

运行时数据为本地 JSON：

```txt
.runtime/data/
  conversations.json       user-characters.json    ai-characters.json
  knowledge-bases.json     api-presets.json        prompt-presets.json
  regex-rules.json         settings.json
```

后端是权威持久化层，前端不读写浏览器 localStorage / IndexedDB。

## 后端

前端请求至本地 `/api`，后端代理再转发到上游；流式聊天透传上游 stream 响应。

```txt
server/index.ts        # 进程入口：读配置、启动 @hono/node-server
server/app.ts          # Hono 装配：CORS、路由注册、错误处理
server/routes/*.ts     # 按领域拆分的路由
```

- 后端错误重试：GET 失败重试 2 次，POST 失败将不会尝试重试
- `baseURL` 只允许 `http` / `https`
- 默认仅在绑定本机时允许访问本机 / 内网上游；绑定公网地址时默认禁止
- 可用 `ALLOW_PRIVATE_UPSTREAMS=true` 显式放开

完整接口契约见 `docs/backend-api.txt`。

## 关键机制

### 宏与正则

用户输入与 AI 输出走同一条管线：

```txt
原文 --[before-macro 规则]--> 宏展开 --> [after-macro 规则] --> 落库 / 展示
```

- **每条规则只执行一次**：`before-macro` 与 `after-macro` 互斥
- **宏只展开一次**，位置在两个阶段之间：`after-macro` 规则替换出来的 `{{char}}` 不会被再次展开
- **代码区域不展开**：fenced 代码块（``` / ~~~）与行内代码里的 `{{...}}` 保持原样，
  避免把 `{{ user }}` 这类 Vue / Handlebars 代码示例替换掉
- **落库即展开**：展示、落库、发给上游三者一致，历史消息不会因为重新展开而让 `{{date}}` 天天变
- **一次回合固定时间**：`now` 在发送时取一次，用户输入与它的回复共用同一时间戳

宏的作用域在两边不同：

| 位置 | 是否展开宏 |
|---|---|
| 提示词条目自定义 `prompt`、内置模板自身 | 展开 |
| 聊天内容（用户输入 / AI 输出），代码区域之外 | 展开 |
| 注入的运行时数据（角色字段、知识库正文、压缩摘要、聊天历史） | 不展开，按原样写入 |
| 聊天内容里的代码块与行内代码 | 不展开 |

变量清单见 `src/modules/system-prompt/README.md`。

### 提示词构建与会话压缩

发送、Prompt 预览、上下文统计共用同一条构建链（`buildSystemPrompt`）：

```txt
发送 / 预览 / 统计 -> buildChatSystemMessagesUseCase -> buildSystemPrompt
```

压缩会把摘要之外的消息标记为已摘要：**原消息仍留在会话文件里**，只是从列表和提示词中隐藏，用摘要替代。手动压缩会压掉当前全部消息（保留 0 条），自动压缩保留最近 2 条。

## 项目结构

```txt
server/          内建后端代理（Hono 路由、repositories、JSON storage）
scripts/         架构边界检查、健康检查、dev 进程管理
e2e/             Selenium 端到端测试
docs/            架构、后端 API 契约、项目状态
src/
  api/            HTTP client 与 stream 解析
  app/            应用级 provider / injection key
  components/     页面组件与通用 UI
  composables/    跨页面通用能力
  features/       按功能收敛的模块（含 chat 的 application / presentation 分层）
  modules/        相对独立的功能模块（system-prompt、markdown、notification…）
  repositories/   存储访问入口
  router/         路由
  services/       服务层
  styles/ utils/  样式与通用工具
```

## 架构边界

```txt
View -> ViewModel -> Controller/Facade -> UseCase -> Repository/Gateway -> Storage/API
```

```bash
npm run check:architecture
```

- `ChatPage.vue` 不直接依赖 API、repository、service、module、通用 composable 业务细节
- chat presentation 不直接访问 raw storage / constants
- chat application 不依赖 Vue、UI、storage、notification、composables

分层细节见 `docs/chat-architecture.md`。

## 常用命令

| 命令 | 用途 |
|---|---|
| `npm run dev` / `dev:client` | Vite 前端开发服务器（:3100） |
| `npm run dev:server` | 内建后端代理（:3900） |
| `npm run build` | 类型检查并构建前端 |
| `npm run preview` | 预览构建产物 |
| `npm run test:run` | Vitest 单测（`test` 为 watch 模式） |
| `npm run test:coverage` | 单测 + 覆盖率 |
| `npm run check:architecture` | 架构边界检查 |
| `npm run e2e` | Selenium 端到端测试，需前后端在线（见 `e2e/README.md`） |
| `npm run health-check` | 全量健康检查（类型 / 依赖 / 架构 / 测试 / 构建 / E2E） |
| `npm run health-check:quick` | 跳过测试、构建、E2E |

验证标准范围：

| 类型 | 需要验证 |
|---|---|
| 普通改动 | `test:run` + `check:architecture` + `build` |
| 聊天模块 | `test:run` + `check:architecture` |
| 渲染 / 宏变量 / 路由等浏览器行为 | 额外跑 `e2e` |
| 提交前 | `health-check` |

## 文档

- `docs/chat-architecture.md`：聊天模块分层与边界规则
- `docs/backend-api.txt`：后端 API 契约
- `docs/project-status.md`：项目现状、工程约定与后续路线
- `e2e/README.md`：端到端测试的编写与运行

模块文档：`src/modules/{api-preset,character-card,chat-prompt,conversation-compression,debug,markdown,notification,system-prompt}/README.md`

> 项目文档（`docs/`、各 module README、代码注释）目前均为中文。

其他语言：[English](./README.md)

## License

MIT
