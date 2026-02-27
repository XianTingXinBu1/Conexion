/**
 * Markdown 渲染模块
 *
 * 提供 Markdown 渲染功能，包括 XSS 防护
 */

// 类型定义
export type {
  MarkdownConfig,
  MarkdownRendererProps,
  UseMarkdownReturn,
  ResolvedMarkdownConfig,
  SanitizerConfig,
  MarkdownHooks,
} from './types';

// Composable
export { useMarkdown, setGlobalMarkdownConfig, getGlobalMarkdownConfig, marked } from './useMarkdown';

// 配置
export {
  DEFAULT_MARKDOWN_CONFIG,
} from './config';

// 组件
export { MarkdownRenderer } from './components';

// 样式
import './styles/index.css';
