/**
 * Markdown 链接/图片地址白名单
 *
 * 回归来源：`render()` 是不经过 DOMPurify 的入口，[x](javascript:alert(1)) 会被
 * 原样渲染成可执行链接；代码围栏的 info string 也能拼出属性注入。
 */
import { describe, expect, it } from 'vitest';
import { toSafeHref, toSafeImageSrc, toSafeLanguageClassToken } from './url';

describe('toSafeHref', () => {
  it('拦截危险协议', () => {
    expect(toSafeHref('javascript:alert(1)')).toBe('');
    expect(toSafeHref('JaVaScRiPt:alert(1)')).toBe('');
    expect(toSafeHref('vbscript:msgbox(1)')).toBe('');
    expect(toSafeHref('data:text/html,<script>alert(1)</script>')).toBe('');
    expect(toSafeHref('file:///etc/passwd')).toBe('');
  });

  it('拦掉带控制字符的变体（浏览器会忽略它们）', () => {
    expect(toSafeHref('java\tscript:alert(1)')).toBe('');
    expect(toSafeHref('java\nscript:alert(1)')).toBe('');
    expect(toSafeHref(' javascript:alert(1)')).toBe('');
  });

  it('放行 http/https/mailto 与相对地址', () => {
    expect(toSafeHref('https://example.com/a?b=1#c')).toBe('https://example.com/a?b=1#c');
    expect(toSafeHref('mailto:a@example.com')).toBe('mailto:a@example.com');
    expect(toSafeHref('#anchor')).toBe('#anchor');
    expect(toSafeHref('/relative/path')).toBe('/relative/path');
    expect(toSafeHref('//example.com/x')).toBe('//example.com/x');
    expect(toSafeHref('')).toBe('');
  });
});

describe('toSafeImageSrc', () => {
  it('只放行 http/https 与相对地址，以及内联 base64 图片', () => {
    expect(toSafeImageSrc('https://example.com/a.png')).toBe('https://example.com/a.png');
    expect(toSafeImageSrc('/local.png')).toBe('/local.png');
    expect(toSafeImageSrc('data:image/png;base64,iVBORw0KGgo=')).toBe('data:image/png;base64,iVBORw0KGgo=');
  });

  it('拦掉非图片的 data: 与 javascript:', () => {
    expect(toSafeImageSrc('data:text/html,<script>alert(1)</script>')).toBe('');
    expect(toSafeImageSrc('javascript:alert(1)')).toBe('');
  });
});

describe('toSafeLanguageClassToken', () => {
  it('只保留 class 名允许的字符', () => {
    expect(toSafeLanguageClassToken('js')).toBe('js');
    expect(toSafeLanguageClassToken('c++')).toBe('c++');
    expect(toSafeLanguageClassToken('objective-c')).toBe('objective-c');
    expect(toSafeLanguageClassToken('"onmouseover=alert(1)')).toBe('onmouseoveralert1');
    // 先按空白切掉后面的 token，再过滤字符：`js"><img` → `jsimg`
    expect(toSafeLanguageClassToken('js"><img src=x onerror=alert(1)>')).toBe('jsimg');
    expect(toSafeLanguageClassToken('')).toBe('');
  });
});
