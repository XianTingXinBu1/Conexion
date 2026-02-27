/**
 * Markdown 渲染模块类型定义
 */

/**
 * Sanitizer 配置
 */
export interface SanitizerConfig {
  /** 是否启用 XSS 防护 */
  enabled: boolean;
  /** 允许的标签 */
  allowedTags?: string[];
  /** 允许的属性 */
  allowedAttributes?: Record<string, string[]>;
}

/**
 * 渲染钩子
 */
export interface MarkdownHooks {
  /** 渲染前处理 */
  beforeRender?: (content: string) => string;
  /** 渲染后处理 */
  afterRender?: (html: string) => string;
}

/**
 * Markdown 渲染配置
 */
export interface MarkdownConfig {
  /** 是否启用 GFM（GitHub Flavored Markdown） */
  gfm?: boolean;
  /** 是否将换行符转换为 <br> */
  breaks?: boolean;
  /** Sanitizer 配置 */
  sanitizer?: Partial<SanitizerConfig>;
  /** 自定义渲染器钩子 */
  hooks?: MarkdownHooks;
}

/**
 * 完整的 Markdown 配置（所有必需字段都有值）
 */
export interface ResolvedMarkdownConfig {
  /** 是否启用 GFM */
  gfm: boolean;
  /** 是否将换行符转换为 <br> */
  breaks: boolean;
  /** Sanitizer 配置 */
  sanitizer: SanitizerConfig;
  /** 自定义渲染器钩子 */
  hooks: MarkdownHooks;
}

/**
 * MarkdownRenderer 组件 Props
 */
export interface MarkdownRendererProps {
  /** Markdown 内容 */
  content: string;
  /** 是否启用渲染（false 时直接显示原文） */
  enabled?: boolean;
  /** 运行时配置（覆盖默认配置） */
  config?: Partial<MarkdownConfig>;
  /** 自定义 CSS 类名 */
  class?: string;
}

/**
 * useMarkdown 返回值
 */
export interface UseMarkdownReturn {
  /** 渲染 Markdown 为 HTML（不含 sanitize） */
  render: (content: string) => string;
  /** 渲染并 sanitize（推荐使用） */
  renderSafe: (content: string) => string;
  /** 重新配置 */
  reconfigure: (newConfig: Partial<MarkdownConfig>) => void;
  /** 重置为默认配置 */
  reset: () => void;
  /** 当前配置 */
  config: ResolvedMarkdownConfig;
  /** 是否已初始化完成 */
  isReady: () => boolean;
}