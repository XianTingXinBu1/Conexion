# Conexion

移动端优先的 AI 聊天前端项目。

## 版本

v0.0.0 beta

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
- 未实现宏系统、Vue Router
- 无测试覆盖（除 system-prompt）


## 许可证

[暂无]

## 仓库

https://github.com/XianTingXinBu1/Conexion