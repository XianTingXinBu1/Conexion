/**
 * Markdown 渲染 Composable
 *
 * 提供 Markdown 渲染功能，整合 XSS 防护
 */

import { marked } from 'marked';
import type { MarkdownConfig, UseMarkdownReturn, ResolvedMarkdownConfig } from './types';
import { DEFAULT_MARKDOWN_CONFIG, CSS_CLASSES } from './config';
import { sanitize, updateSanitizerConfig, resetSanitizerConfig } from './sanitizer';

// 全局配置
let globalConfig: ResolvedMarkdownConfig = { ...DEFAULT_MARKDOWN_CONFIG };
let isInitialized = false;
let initializationPromise: Promise<void> | null = null;

/**
 * 创建自定义渲染器
 */
function createRenderer() {
  const renderer = new marked.Renderer();

  // 自定义代码块渲染（不使用高亮）
  renderer.code = ({ text, lang }) => {
    const language = lang || '';
    const langClass = language ? `${CSS_CLASSES.highlightPrefix}${language}` : '';
    const escapedCode = escapeHtml(text);

    // 添加 code-wrapper 层，使复制按钮不跟随滚动
    return `<pre class="${CSS_CLASSES.codeBlock}${langClass ? ` ${langClass}` : ''}"><div class="code-wrapper"><code>${escapedCode}</code></div></pre>`;
  };

  // 自定义行内代码渲染
  renderer.codespan = (text) => {
    return `<code class="${CSS_CLASSES.inlineCode}">${text}</code>`;
  };

  // 自定义链接渲染
  renderer.link = ({ href, title, text }) => {
    const safeHref = escapeHtmlAttribute(href || '');
    const titleAttr = title ? ` title="${escapeHtmlAttribute(title)}"` : '';
    return `<a href="${safeHref}"${titleAttr} target="_blank" rel="noopener noreferrer">${text}</a>`;
  };

  // 自定义图片渲染
  renderer.image = ({ href, title, text }) => {
    const safeSrc = escapeHtmlAttribute(href || '');
    const titleAttr = title ? ` title="${escapeHtmlAttribute(title)}"` : '';
    const altAttr = text ? ` alt="${escapeHtmlAttribute(text)}"` : '';
    return `<img src="${safeSrc}"${altAttr}${titleAttr} loading="lazy" />`;
  };

  return renderer;
}

/**
 * 转义 HTML
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (char) => map[char] ?? char);
}

/**
 * 转义 HTML 属性值
 */
function escapeHtmlAttribute(value: string): string {
  return escapeHtml(value);
}

/**
 * 初始化 Markdown 渲染器
 */
async function initialize(config: ResolvedMarkdownConfig): Promise<void> {
  // 如果已经初始化且配置相同，直接返回
  if (isInitialized && JSON.stringify(config) === JSON.stringify(globalConfig)) {
    return;
  }

  // 如果正在初始化，等待当前初始化完成
  if (initializationPromise) {
    await initializationPromise;
    // 初始化完成后，再次检查配置
    if (isInitialized && JSON.stringify(config) === JSON.stringify(globalConfig)) {
      return;
    }
  }

  // 创建新的初始化 Promise
  initializationPromise = (async () => {
    try {
      // 配置 marked
      const renderer = createRenderer();

      marked.setOptions({
        renderer,
        gfm: config.gfm,
        breaks: config.breaks,
      });

      // 更新 sanitizer 配置
      if (config.sanitizer) {
        updateSanitizerConfig(config.sanitizer);
      }

      globalConfig = config;
      isInitialized = true;
    } finally {
      initializationPromise = null;
    }
  })();

  // 等待初始化完成
  await initializationPromise;
}

/**
 * Markdown 渲染 Composable
 */
export function useMarkdown(config?: Partial<MarkdownConfig>): UseMarkdownReturn {
  // 合并配置
  const mergedConfig: ResolvedMarkdownConfig = {
    ...DEFAULT_MARKDOWN_CONFIG,
    ...config,
    sanitizer: {
      ...DEFAULT_MARKDOWN_CONFIG.sanitizer,
      ...config?.sanitizer,
    },
    hooks: {
      ...DEFAULT_MARKDOWN_CONFIG.hooks,
      ...config?.hooks,
    },
  };

  // 确保初始化
  if (!isInitialized) {
    initialize(mergedConfig).catch(console.error);
  }

  /**
   * 渲染 Markdown 为 HTML（不含 sanitize）
   */
  function render(content: string): string {
    if (!content) return '';

    // 应用 beforeRender 钩子
    let processedContent = content;
    if (mergedConfig.hooks?.beforeRender) {
      processedContent = mergedConfig.hooks.beforeRender(processedContent);
    }

    // 渲染
    let html = marked.parse(processedContent) as string;

    // 应用 afterRender 钩子
    if (mergedConfig.hooks?.afterRender) {
      html = mergedConfig.hooks.afterRender(html);
    }

    return html;
  }

  /**
   * 渲染并 sanitize（推荐使用）
   */
  function renderSafe(content: string): string {
    const html = render(content);
    return sanitize(html, mergedConfig.sanitizer);
  }

  /**
   * 重新配置
   */
  async function reconfigure(newConfig: Partial<MarkdownConfig>): Promise<void> {
    const updatedConfig: ResolvedMarkdownConfig = {
      ...globalConfig,
      ...newConfig,
      sanitizer: {
        ...globalConfig.sanitizer,
        ...newConfig.sanitizer,
      },
      hooks: {
        ...globalConfig.hooks,
        ...newConfig.hooks,
      },
    };

    isInitialized = false;
    await initialize(updatedConfig);
  }

  /**
   * 重置为默认配置
   */
  function reset(): void {
    globalConfig = { ...DEFAULT_MARKDOWN_CONFIG };
    isInitialized = false;
    resetSanitizerConfig();
  }

  return {
    render,
    renderSafe,
    reconfigure,
    reset,
    config: globalConfig,
    isReady: () => isInitialized,
  };
}

/**
 * 设置全局配置
 */
export async function setGlobalMarkdownConfig(config: Partial<MarkdownConfig>): Promise<void> {
  const newConfig: ResolvedMarkdownConfig = {
    ...globalConfig,
    ...config,
    sanitizer: {
      ...globalConfig.sanitizer,
      ...config.sanitizer,
    },
    hooks: {
      ...globalConfig.hooks,
      ...config.hooks,
    },
  };

  isInitialized = false;
  await initialize(newConfig);
}

/**
 * 获取全局配置
 */
export function getGlobalMarkdownConfig(): ResolvedMarkdownConfig {
  return { ...globalConfig };
}

/**
 * 导出 marked 实例（用于高级用法）
 */
export { marked };