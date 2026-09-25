/**
 * Markdown 渲染模块配置
 */

import type { ResolvedMarkdownConfig, SanitizerConfig } from './types';

/**
 * 默认允许的 HTML 标签
 */
export const DEFAULT_ALLOWED_TAGS = [
  // 标题
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  // 文本
  'p', 'br', 'hr', 'strong', 'em', 'del', 'ins', 'code', 'pre',
  // 内联语义标签
  'kbd', 'mark', 'sub', 'sup', 'abbr',
  // 列表
  'ul', 'ol', 'li',
  // 引用
  'blockquote',
  // 折叠块（模型输出长内容时常用）
  'details', 'summary',
  // 表格
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  // 链接和图片
  'a', 'img',
  // 任务列表复选框（由 sanitizer 收紧为不可交互的 disabled checkbox）
  'input',
  // 其他
  'span', 'div',
];

/**
 * 默认允许的属性（按标签维度）
 *
 * 注意：DOMPurify 的 ALLOWED_ATTR 是全局列表，这里的 per-tag 结构会被
 * sanitizer.ts 摊平后作为粗过滤，再由 afterSanitizeAttributes 钩子按标签收紧。
 */
export const DEFAULT_ALLOWED_ATTRIBUTES: Record<string, string[]> = {
  'a': ['href', 'title', 'target', 'rel'],
  'img': ['src', 'alt', 'title', 'loading'],
  'code': ['class'],
  'pre': ['class'],
  'span': ['class'],
  // 代码块的 code-wrapper 靠 class 获得横向滚动，缺失会导致长代码行溢出
  'div': ['class'],
  'input': ['type', 'checked', 'disabled'],
  // <details open> 控制默认展开；abbr 的 title 是悬浮释义
  'details': ['open'],
  'abbr': ['title'],
  // 脚注标记需要自己的 class（.footnote-ref），否则无法与普通上标区分
  'sup': ['class'],
  'td': ['align'],
  'th': ['align'],
  'table': ['class'],
};

/**
 * 默认 Sanitizer 配置
 */
export const DEFAULT_SANITIZER_CONFIG: SanitizerConfig = {
  enabled: true,
  allowedTags: DEFAULT_ALLOWED_TAGS,
  allowedAttributes: DEFAULT_ALLOWED_ATTRIBUTES,
};

/**
 * 默认 Markdown 配置
 */
export const DEFAULT_MARKDOWN_CONFIG: ResolvedMarkdownConfig = {
  gfm: true,
  breaks: true,
  sanitizer: DEFAULT_SANITIZER_CONFIG,
  hooks: {
    beforeRender: undefined,
    afterRender: undefined,
  },
};

/**
 * CSS 类名常量
 */
export const CSS_CLASSES = {
  container: 'markdown-renderer',
  codeBlock: 'code-block',
  inlineCode: 'inline-code',
  highlightPrefix: 'language-',
} as const;
