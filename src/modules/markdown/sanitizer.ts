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
 * 配置 DOMPurify 钩子
 */
function setupHooks(): void {
  // 确保所有链接都有安全属性
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    // 处理链接
    if (node.tagName === 'A') {
      const href = node.getAttribute('href');
      if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
        node.setAttribute('target', '_blank');
        node.setAttribute('rel', 'noopener noreferrer');
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

  // 构建属性白名单
  const allowedAttrList: string[] = [];
  const attrAllowedTags: Record<string, string[]> = {};

  for (const [tag, attrs] of Object.entries(allowedAttributes)) {
    attrAllowedTags[tag] = attrs;
    allowedAttrList.push(...attrs);
  }

  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: allowedTags,
    ALLOWED_ATTR: allowedAttrList,
    ALLOW_DATA_ATTR: false,
    ADD_ATTR: ['target', 'rel'],
    FORCE_BODY: true,
    // 允许特定标签的特定属性
    ALLOW_ARIA_ATTR: true,
    // 保持 HTML 实体
    KEEP_CONTENT: true,
  });
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
}

/**
 * 获取当前配置
 */
export function getSanitizerConfig(): SanitizerConfig {
  return { ...currentConfig };
}

/**
 * 检查 HTML 是否安全（用于调试）
 */
export function isHtmlSafe(html: string): boolean {
  const sanitized = sanitize(html);
  return sanitized === html;
}

/**
 * 移除所有脚本相关内容（更严格的清理）
 */
export function sanitizeStrict(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'span', 'a', 'code', 'pre'],
    ALLOWED_ATTR: ['href', 'class', 'target', 'rel'],
    ALLOW_DATA_ATTR: false,
    FORCE_BODY: true,
  });
}
