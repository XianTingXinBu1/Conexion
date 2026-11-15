/**
 * Markdown 里的链接 / 图片地址过滤
 *
 * marked 的 `href` / `src` 完全来自消息内容，属于不可信输入。
 * 只做 HTML 实体转义是不够的：`javascript:alert(1)`、`data:text/html,...`、
 * `vbscript:` 以及 `java\tscript:`（带控制字符）这类写法都能穿过转义，
 * 在 `render()`（不做 DOMPurify 的入口）上直接变成可执行 URL。
 *
 * 这里按协议白名单过滤：
 * - 允许 http / https（图片再加 data:image/*）
 * - 允许相对路径、锚点、协议相对地址（`//host/x`）
 * - 其它协议（javascript / data / vbscript / file …）一律返回空串，由调用方降级为纯文本
 */

const LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);
const IMAGE_PROTOCOLS = new Set(['http:', 'https:']);

/** `data:image/png;base64,...` 这类内联图片单独放行，其余 data: 一律拒绝 */
const INLINE_IMAGE_RE = /^data:image\/(?:png|jpe?g|gif|webp|avif|bmp);base64,[a-z0-9+/=\s]+$/i;

/**
 * 去掉空白与控制字符后再判断协议。
 *
 * 浏览器解析 URL 时会忽略这些字符，所以 `java\tscript:` 实际仍是 `javascript:`，
 * 直接对原串做前缀匹配会被绕过。
 */
function compactForSchemeCheck(value: string): string {
  return value.replace(/[\u0000-\u0020\u007f]+/g, '');
}

function safeUrl(raw: string, allowed: Set<string>): string {
  const value = raw.trim();
  if (!value) return '';

  const schemeMatch = compactForSchemeCheck(value).match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/);
  const scheme = schemeMatch?.[1];
  // 没有协议：相对路径 / 锚点 / 协议相对地址，保持原样
  if (!scheme) return value;

  return allowed.has(`${scheme.toLowerCase()}:`) ? value : '';
}

/** 链接地址：只放行 http / https / mailto 与相对地址，其余返回空串 */
export function toSafeHref(raw: string): string {
  return safeUrl(raw, LINK_PROTOCOLS);
}

/** 图片地址：只放行 http / https 与相对地址（外加内联 base64 图片），其余返回空串 */
export function toSafeImageSrc(raw: string): string {
  if (INLINE_IMAGE_RE.test(raw.trim())) return raw.trim();
  return safeUrl(raw, IMAGE_PROTOCOLS);
}

/** 代码围栏的 info string 只能贡献 class 名，去掉一切非安全字符 */
export function toSafeLanguageClassToken(lang: string): string {
  const [first = ''] = lang.trim().split(/\s+/);
  return first.replace(/[^\w+#.-]/g, '');
}
