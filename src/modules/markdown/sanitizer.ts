/**
 * DOMPurify XSS 防护封装
 *
 * 提供安全的 HTML 清理功能，防止 XSS 攻击
 *
 * 关键点：这里用的是**私有 DOMPurify 实例**，不是包默认导出的全局实例。
 * DOMPurify 的钩子是挂在实例上的，注册在全局实例上会污染整个应用里所有调用
 * （典型受害者：PromptPreviewModal 用 `ALLOWED_ATTR: ['class']` 保留高亮 mark 的 class，
 * 结果被这里的「未声明标签不允许任何属性」钩子清掉）。
 */

import createPurify from 'dompurify';
import type { SanitizerConfig } from './types';
import { DEFAULT_SANITIZER_CONFIG, DEFAULT_ALLOWED_TAGS, DEFAULT_ALLOWED_ATTRIBUTES } from './config';

/**
 * Sanitizer 实例配置
 */
let currentConfig: SanitizerConfig = DEFAULT_SANITIZER_CONFIG;

/**
 * 当前生效的「按标签」属性白名单
 *
 * DOMPurify 的 ALLOWED_ATTR 是全局列表，无法表达「href 只能出现在 a 上」，
 * 所以这里额外保留一份 per-tag 映射，在 afterSanitizeAttributes 里收紧。
 *
 * 这是「单次调用」的临时状态：sanitize() 是同步的，进函数时设置、出函数时还原，
 * 不会跨调用泄漏。
 */
let activeAttrAllowMap: Record<string, string[]> = DEFAULT_ALLOWED_ATTRIBUTES;

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#039;',
};

/** 关闭清洗时把 HTML 转成纯文本，而不是原样返回 */
function escapeHtml(html: string): string {
  return html.replace(/[&<>"']/g, char => HTML_ESCAPES[char] ?? char);
}

interface Purifier {
  sanitize: (dirty: string, config?: Record<string, unknown>) => string;
  addHook: (name: string, hook: (node: Element) => void) => void;
}

let purifier: Purifier | null = null;

function getPurifier(): Purifier {
  if (purifier) return purifier;

  // 浏览器里新建一个独立实例；非浏览器环境（node 单测）退回默认实例，
  // 此时 DOMPurify 本身是 no-op，钩子也不会影响别人。
  purifier = (
    typeof window === 'undefined' ? createPurify : createPurify(window)
  ) as unknown as Purifier;

  purifier.addHook('afterSanitizeAttributes', node => {
    const tag = node.tagName?.toLowerCase();
    if (!tag) return;

    // 1. 链接硬化：外部链接补齐 target / rel
    if (tag === 'a') {
      const href = node.getAttribute('href');
      if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
        node.setAttribute('target', '_blank');
        node.setAttribute('rel', 'noopener noreferrer');
      }
    }

    // 2. per-tag 属性收紧：未声明的标签不允许携带任何属性，
    //    已声明的标签只保留列出的属性，避免 <p href> 这类越界属性残留。
    const allowedForTag = activeAttrAllowMap[tag] ?? [];
    for (const attr of Array.from(node.attributes ?? [])) {
      if (!allowedForTag.includes(attr.name)) {
        node.removeAttribute(attr.name);
      }
    }

    // 3. 任务列表复选框：只保留不可交互的 disabled checkbox，
    //    否则用户 HTML 可以注入文本框 / 文件上传这类可交互控件。
    if (tag === 'input') {
      const type = node.getAttribute('type')?.toLowerCase();
      if (type !== 'checkbox' || !node.hasAttribute('disabled')) {
        node.remove();
      }
    }
  });

  return purifier;
}

/**
 * 清理 HTML 内容
 */
export function sanitize(html: string, config?: Partial<SanitizerConfig>): string {
  const mergedConfig = config ? { ...currentConfig, ...config } : currentConfig;

  // 关闭清洗时整段内容按纯文本输出。
  // 以前这里直接 return html，等于「把开关拨到 off 就恢复 XSS」，
  // 而这个开关本身可由外部配置传入。
  if (!mergedConfig.enabled) {
    return escapeHtml(html);
  }

  const allowedTags = mergedConfig.allowedTags ?? DEFAULT_ALLOWED_TAGS;
  const allowedAttributes = mergedConfig.allowedAttributes ?? DEFAULT_ALLOWED_ATTRIBUTES;

  // DOMPurify 只接受「全局」属性列表，这里摊平作为粗过滤；
  // 精确的按标签限制由 afterSanitizeAttributes 钩子完成。
  const allowedAttrList = Array.from(
    new Set(
      Object.values(allowedAttributes).reduce<string[]>((acc, attrs) => acc.concat(attrs), []),
    ),
  );

  const previousAttrAllowMap = activeAttrAllowMap;
  activeAttrAllowMap = allowedAttributes;
  try {
    return getPurifier().sanitize(html, {
      ALLOWED_TAGS: allowedTags,
      ALLOWED_ATTR: allowedAttrList,
      ALLOW_DATA_ATTR: false,
      ADD_ATTR: ['target', 'rel'],
      FORCE_BODY: true,
      ALLOW_ARIA_ATTR: true,
      // 移除标签时保留其文本内容
      KEEP_CONTENT: true,
    });
  } finally {
    activeAttrAllowMap = previousAttrAllowMap;
  }
}

/**
 * 更新 Sanitizer 配置
 */
export function updateSanitizerConfig(config: Partial<SanitizerConfig>): void {
  currentConfig = { ...currentConfig, ...config };
}

/**
 * 重置为默认配置
 */
export function resetSanitizerConfig(): void {
  currentConfig = DEFAULT_SANITIZER_CONFIG;
  activeAttrAllowMap = DEFAULT_ALLOWED_ATTRIBUTES;
}
