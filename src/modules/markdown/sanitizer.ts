/**
 * DOMPurify XSS 防护封装
 *
 * 提供安全的 HTML 清理功能，防止 XSS 攻击
 */

import DOMPurify from 'dompurify';
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
 */
let currentAttrAllowMap: Record<string, string[]> = DEFAULT_ALLOWED_ATTRIBUTES;

/**
 * 配置 DOMPurify 钩子
 */
function setupHooks(): void {
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
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
    const allowedForTag = currentAttrAllowMap[tag] ?? [];
    for (const attr of Array.from(node.attributes ?? [])) {
      if (!allowedForTag.includes(attr.name)) {
        node.removeAttribute(attr.name);
      }
    }
  });
}

// 初始化时设置钩子
setupHooks();

/**
 * 清理 HTML 内容
 */
export function sanitize(html: string, config?: Partial<SanitizerConfig>): string {
  const mergedConfig = config ? { ...currentConfig, ...config } : currentConfig;

  if (!mergedConfig.enabled) {
    return html;
  }

  const allowedTags = mergedConfig.allowedTags ?? DEFAULT_ALLOWED_TAGS;
  const allowedAttributes = mergedConfig.allowedAttributes ?? DEFAULT_ALLOWED_ATTRIBUTES;

  // hook 里的 per-tag 收紧必须读取本次调用同一份配置
  currentAttrAllowMap = allowedAttributes;

  // DOMPurify 只接受「全局」属性列表，这里摊平作为粗过滤；
  // 精确的按标签限制由 afterSanitizeAttributes 钩子完成。
  const allowedAttrList = Array.from(
    new Set(
      Object.values(allowedAttributes).reduce<string[]>((acc, attrs) => acc.concat(attrs), []),
    ),
  );

  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: allowedTags,
    ALLOWED_ATTR: allowedAttrList,
    ALLOW_DATA_ATTR: false,
    ADD_ATTR: ['target', 'rel'],
    FORCE_BODY: true,
    ALLOW_ARIA_ATTR: true,
    // 移除标签时保留其文本内容
    KEEP_CONTENT: true,
  });
}

/**
 * 更新 Sanitizer 配置
 */
export function updateSanitizerConfig(config: Partial<SanitizerConfig>): void {
  currentConfig = { ...currentConfig, ...config };
  if (config.allowedAttributes) {
    currentAttrAllowMap = config.allowedAttributes;
  }
}

/**
 * 重置为默认配置
 */
export function resetSanitizerConfig(): void {
  currentConfig = DEFAULT_SANITIZER_CONFIG;
  currentAttrAllowMap = DEFAULT_ALLOWED_ATTRIBUTES;
}
