# Conexion

移动端优先的 AI 聊天前端项目。

## 技术栈

Vue 3.5.25 | TypeScript 5.9.3 | Vite 7.3.1 | Tailwind CSS 4.1.18

## 核心功能

- **会话管理**: 临时/角色会话、持久化
- **API**: OpenAI 兼容格式
- **智能提示词**: 动态构建（角色/用户/知识库/预设）
- **聊天**: Markdown 渲染、代码高亮、流式响应、Token 计数
- **存储**: localStorage + IndexedDB 混合存储
- **调试**: 浏览器控制台日志追踪

## 快速开始

```bash
npm install && npm run dev
```

## 开发命令

```bash
npm run dev
npm run build
npm run test:run
npm run test:coverage
```

## 应用入口

- `src/main.ts`: 创建 Vue 应用并挂载 Router
- `src/App.vue`: 根壳层，包裹 `AppProvider`、`router-view` 与通知容器
- `src/components/AppProvider.vue`: 初始化全局主题、角色、设置、默认提示词预设
- `src/router/index.ts`: 使用 `createWebHashHistory()` 管理页面路由

当前项目**已经实现 Vue Router**，并使用 **Hash 路由**。

## 核心架构

- `src/components/`: 页面与 UI 组件，`ChatPage.vue` 是聊天总控入口
- `src/composables/`: 业务状态与持久化入口，如会话、角色、设置、知识库
- `src/modules/`: 独立功能模块，如 system-prompt、notification、markdown、api-preset
- `src/api/`: OpenAI 兼容接口调用、流式解析、错误处理
- `src/utils/storage.ts`: 存储边界，按 key 分流到 localStorage / IndexedDB

## 测试现状

- 使用 **Vitest + happy-dom**
- 当前优先覆盖纯逻辑模块：
  - `src/modules/system-prompt/**`
  - `src/utils/urlValidator.ts`
- 运行 `npm run test:run` 可执行当前单元测试

## 当前已知架构风险

- `src/components/ChatPage.vue` 责任很多，是当前最臃肿、最容易牵连回归的文件
- 会话、设置、确认弹窗存在重复/重叠实现，详见 `docs/project-audit.md`
- 文档与代码曾有漂移，后续应以代码和测试为准

## 项目结构

```
src/
├── components/    # Vue 组件
├── composables/   # 业务逻辑复用
├── modules/       # 功能模块
├── styles/        # 模块化样式
├── utils/         # 工具函数
├── types.ts       # 类型定义
└── constants.ts   # 常量/存储键
```

## 已知限制

- 正则仅支持 'after-macro'
- 未实现宏系统
- 暂无完整端到端测试

## 架构审计

- 重复实现、热点模块、测试系统审计见：`docs/project-audit.md`


## 许可证

[暂无]

## 仓库

https://github.com/XianTingXinBu1/Conexion
