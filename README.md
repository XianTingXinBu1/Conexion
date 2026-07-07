# Conexion

Conexion 是一个移动端优先的 AI 聊天应用，支持 OpenAI 兼容接口。

项目包含：

- Vue 3 + TypeScript + Vite 前端
- 内建 Node.js 后端代理
- OpenAI 兼容 `/chat/completions` 与 `/models` 转发
- Vitest 测试、聊天架构边界检查和健康检查脚本

## 功能特性

- 多会话
  - 临时会话 / 持久化会话
  - 会话列表
  - 消息编辑 / 删除
- OpenAI 兼容 API 接入
  - API 预设管理
  - 模型列表加载
  - 连接测试
  - 流式 / 非流式请求
- 内建后端代理
  - `GET /api/health`
  - `GET|POST /api/models`
  - `POST /api/connection-test`
  - `POST /api/chat/completions`
- Prompt 预设
  - 多条目提示词
  - `system` / `user` / `assistant` 角色类型
  - 插入位置排序
  - Prompt 预览
- 角色设定
  - 用户角色
  - AI 角色
  - AI 角色可绑定知识库
- 知识库
  - 多知识库 / 多条目
  - 启用 / 禁用
  - 优先级排序
- 正则脚本
  - 用户输入处理
  - AI 输出处理
  - 可配置作用域与应用时机
- Markdown 渲染
  - `marked`
  - `DOMPurify`
  - 代码块复制
- 上下文统计与会话压缩
  - token 估算
  - 上下文使用率
  - 手动 / 自动压缩
- 本地存储
  - localStorage
  - IndexedDB

## 技术栈

- Vue 3
- TypeScript
- Vite
- Vue Router
- Vitest
- Tailwind CSS / PostCSS
- marked
- DOMPurify
- idb-keyval
- gpt-tokenizer
- lucide-vue-next
- Node.js 原生 HTTP server

## 本地开发

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制示例配置：

```bash
cp .env.example .env
```

`.env.example` 默认配置：

```env
HOST=127.0.0.1
PORT=3900
CLIENT_ORIGIN=http://127.0.0.1:3100
DEFAULT_UPSTREAM_BASE_URL=
DEFAULT_UPSTREAM_API_KEY=
ALLOW_PRIVATE_UPSTREAMS=
MAX_BODY_BYTES=
```

常用变量说明：

- `HOST`：后端代理监听地址，默认 `127.0.0.1`
- `PORT`：后端代理端口，默认 `3900`
- `CLIENT_ORIGIN`：允许跨域的前端地址，默认 `http://127.0.0.1:3100`
- `DEFAULT_UPSTREAM_BASE_URL`：默认上游 OpenAI 兼容 API 地址
- `DEFAULT_UPSTREAM_API_KEY`：默认上游 API Key
- `ALLOW_PRIVATE_UPSTREAMS`：是否允许访问本机 / 内网上游
- `MAX_BODY_BYTES`：请求体最大字节数，默认 1 MiB

### 3. 启动前端

```bash
npm run dev:client
```

前端默认运行在：

```txt
http://127.0.0.1:3100
```

Vite 会把 `/api` 代理到：

```txt
http://127.0.0.1:3900
```

### 4. 启动后端代理

```bash
npm run dev:server
```

后端默认运行在：

```txt
http://127.0.0.1:3900
```

### 5. 或仅启动前端

```bash
npm run dev
```

`npm run dev` 等价于 Vite 前端开发服务器。需要完整 API 代理能力时，请同时运行 `npm run dev:server`。

## 常用脚本

```bash
npm run dev
npm run dev:client
npm run dev:server
npm run build
npm run preview
npm run test
npm run test:run
npm run test:coverage
npm run check:architecture
npm run health-check
npm run health-check:quick
npm run health-check:verbose
```

说明：

- `dev` / `dev:client`：启动 Vite 前端开发服务器
- `dev:server`：启动内建后端代理
- `build`：类型检查并构建前端
- `test:run`：运行 Vitest
- `test:coverage`：运行测试并生成覆盖率
- `check:architecture`：检查聊天模块架构边界
- `health-check`：执行项目健康检查
- `health-check:quick`：跳过测试和构建的快速健康检查
- `health-check:verbose`：输出更详细的健康检查日志

## 内建后端代理

后端入口：

```txt
server/index.ts
```

当前支持接口：

```txt
GET  /api/health
GET  /api/models
POST /api/models
POST /api/connection-test
POST /api/chat/completions
```

代理行为：

- 前端配置 OpenAI 兼容上游 `baseURL` 和 `apiKey`
- 请求先发到本地 `/api`
- 后端代理再转发到上游服务
- 流式聊天会透传上游 stream 响应

安全限制：

- `baseURL` 只允许 `http` / `https`
- 默认仅在后端绑定本机时允许本机 / 内网上游
- 如果后端绑定到公网地址，默认禁止访问本机 / 内网上游
- 可通过 `ALLOW_PRIVATE_UPSTREAMS=true` 显式放开

## 项目结构

```txt
.
├── server/                  # 内建后端代理
│   ├── index.ts
│   └── index.test.ts
├── scripts/                 # 架构检查和健康检查脚本
├── docs/                    # 项目文档
├── src/
│   ├── api/                 # 前端 API client 与 stream 解析
│   ├── app/                 # 应用级 provider / injection key
│   ├── components/          # 页面组件与通用 UI
│   ├── composables/         # Vue composable 与页面适配逻辑
│   ├── features/            # 按功能收敛的新架构模块
│   │   └── chat/
│   │       ├── application/ # 聊天 use case
│   │       └── presentation/# 聊天页面 ViewModel / Controller
│   ├── modules/             # 相对独立的功能模块
│   ├── repositories/        # 存储访问入口
│   ├── router/              # Vue Router
│   ├── services/            # 服务层
│   ├── styles/              # 全局样式
│   ├── utils/               # 通用工具函数
│   ├── constants.ts
│   └── types.ts
├── .env.example
├── package.json
└── vite.config.ts
```

## 聊天模块架构

聊天模块遵循：

```txt
View -> ViewModel -> Controller/Facade -> UseCase -> Repository/Gateway -> Storage/API
```

核心文件：

```txt
src/components/ChatPage.vue
src/features/chat/presentation/useChatPageViewModel.ts
src/features/chat/presentation/useChatSessionFacade.ts
src/features/chat/presentation/useChatCompressionController.ts
src/features/chat/presentation/useChatPromptController.ts
src/features/chat/presentation/useChatLifecycleController.ts
src/features/chat/application/sendMessage.usecase.ts
src/features/chat/application/buildSystemMessages.usecase.ts
src/features/chat/application/streamMessageAssembler.ts
```

架构边界由脚本检查：

```bash
npm run check:architecture
```

当前核心规则包括：

- `ChatPage.vue` 不直接依赖 API、repository、service、module、通用 composable 业务细节
- chat presentation 不直接访问 raw storage / constants
- chat application 不依赖 Vue、UI、storage、notification、composables

更多说明见：

```txt
docs/chat-architecture.md
```

## 验证建议

普通开发后建议运行：

```bash
npm run test:run
npm run check:architecture
npm run build
```

提交前建议运行：

```bash
npm run health-check
```

聊天相关代码改动后，至少运行：

```bash
npm run test:run
npm run check:architecture
```

## 文档

推荐优先阅读：

- `docs/chat-architecture.md`：当前聊天模块架构与边界
- `docs/project-audit.md`：当前项目健康度与风险点
- `docs/chatpage-refactor-blueprint.md`：聊天页后续重构蓝图
- `docs/chat-coupling-permanent-refactor-plan.txt`：聊天耦合长期治理路线图

模块文档：

- `src/modules/api-preset/README.md`
- `src/modules/debug/README.md`
- `src/modules/markdown/README.md`
- `src/modules/notification/README.md`
- `src/modules/system-prompt/README.md`

## License

MIT
