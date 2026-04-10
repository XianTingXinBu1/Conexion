# Conexion

一个移动端优先的 AI 聊天前端。

支持角色、人设提示词、知识库、流式回复，以及 OpenAI 兼容接口。现在已经能正常跑，也还在继续慢慢收结构。

## 在线体验

- <https://conexion.venturoso.sbs>

## 技术栈

- Vue 3
- TypeScript
- Vite
- Tailwind CSS
- Vitest

## 功能

- 会话管理（临时会话 / 持久化会话）
- OpenAI 兼容 API 接入
- Prompt 预设与动态 system prompt 构建
- 角色 / 用户设定
- 知识库注入
- Markdown 渲染与流式输出
- localStorage + IndexedDB 混合存储

## 本地开发

```bash
npm install
npm run dev
```

```bash
npm run build
npm run test:run
npm run test:coverage
```

## 项目结构

```text
src/
├── components/   # 页面和 UI 组件
├── composables/  # 状态与业务逻辑
├── modules/      # 相对独立的功能模块
├── api/          # 接口调用与流式处理
├── utils/        # 工具函数
├── styles/       # 样式
├── constants.ts
└── types.ts
```

## 详细文档

- `docs/project-audit.md`
- `docs/chatpage-refactor-blueprint.md`

## License

MIT
