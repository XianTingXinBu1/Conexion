// @vitest-environment happy-dom
/**
 * DOMPurify 封装的边界
 *
 * 回归来源：`enabled: false` 时直接 return html，等于「把开关拨到 off 就恢复 XSS」，
 * 而这个开关本身可由外部配置传入。
 *
 * 说明：DOM 级断言（标签/属性是否真的被删）只能放在 E2E 里做——
 * happy-dom 下 DOMPurify 并不可信（连 `<script>` 都不会被移除），
 * 这条约定与 markdown.test.ts 里「class 保留由 E2E 验证」一致。
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { resetSanitizerConfig, sanitize } from './sanitizer';

describe('sanitize', () => {
  beforeEach(() => {
    resetSanitizerConfig();
  });

  it('关闭清洗时降级为纯文本，而不是原样返回', () => {
    const html = sanitize('<img src=x onerror=alert(1)>', { enabled: false });

    expect(html).not.toContain('<img');
    expect(html).toBe('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('关闭清洗时转义引号与尖括号，不能拼出可执行 HTML', () => {
    const html = sanitize('<a href="x" onclick=\'alert(1)\'>l</a>', { enabled: false });

    expect(html).toBe('&lt;a href=&quot;x&quot; onclick=&#039;alert(1)&#039;&gt;l&lt;/a&gt;');
  });

  it('默认配置下不抛错并且是字符串结果', () => {
    const html = sanitize('<p>ok</p>');

    expect(typeof html).toBe('string');
  });
});
