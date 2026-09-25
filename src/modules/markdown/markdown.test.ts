// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { useMarkdown } from './useMarkdown';

describe('markdown security boundaries', () => {
  beforeEach(() => {
    const { reset } = useMarkdown();
    reset();
  });

  it('keeps external links hardened after safe rendering', () => {
    const { renderSafe } = useMarkdown();

    const html = renderSafe('[safe](https://example.com)');

    expect(html).toContain('<a');
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it('does not allow quoted title payloads to break into real link attributes', () => {
    const { render } = useMarkdown();

    const html = render('[safe](https://example.com "bad\" onclick=\"alert(1)")');

    expect(html).toContain('<a href="https://example.com"');
    expect(html).not.toContain(' onclick="alert(1)"');
  });

  it('escapes image attributes during raw markdown rendering', () => {
    const { render } = useMarkdown();

    const html = render('![safe alt](https://example.com/test.png "title &quot;quoted&quot;")');

    expect(html).toContain('<img');
    expect(html).toContain('src="https://example.com/test.png"');
    expect(html).toContain('title="title &amp;quot;quoted&amp;quot;"');
  });

  it('renders inline code as escaped literal text', () => {
    const { render } = useMarkdown();

    const html = render('`<b>bold</b>`');

    expect(html).toContain('<code class="inline-code">');
    expect(html).toContain('&lt;b&gt;bold&lt;/b&gt;');
    // 回归：marked 新版 renderer 回调改为 token 对象，曾导致插值出 [object Object]
    expect(html).not.toContain('[object Object]');
  });

  it('renders inline markdown inside link text', () => {
    const { render } = useMarkdown();

    // 回归：renderer.link 曾直接插值 token.text（未解析），链接文本里的
    // markdown 会以字面量显示，如 "**bold**" / "`code`"。
    expect(render('[**bold**](https://example.com)')).toContain('<strong>bold</strong>');
    expect(render('[`code`](https://example.com)')).toContain(
      '<code class="inline-code">code</code>',
    );
    expect(render('[![alt](https://example.com/a.png)](https://example.com)')).toContain('<img');
    expect(render('[**bold**](https://example.com)')).not.toContain('**bold**');
  });

  it('flattens emphasis in image alt text', () => {
    const { render } = useMarkdown();

    expect(render('![a **b**](https://example.com/a.png)')).toContain('alt="a b"');
  });

  it('renders math formulas through the public renderer', () => {
    const { render } = useMarkdown();

    expect(render('$E=mc^2$')).toContain('class="katex"');
    expect(render('$$\n\\int_0^1 x\\,dx\n$$')).toContain('class="katex-block"');
    // 货币符号不应被当成公式
    expect(render('价格是 $5 和 $10')).not.toContain('katex');
  });

  it('renders footnotes instead of broken reference links', () => {
    const { render } = useMarkdown();

    const html = render('正文[^1]\n\n[^1]: 脚注内容');

    expect(html).toContain('<sup class="footnote-ref">[1]</sup>');
    expect(html).toContain('class="footnotes"');
    // 回归：marked 会把定义当成引用式链接定义，生成 href="脚注内容"
    expect(html).not.toContain('href="脚注内容"');
  });

  it('keeps collapsible details markup', () => {
    const { render } = useMarkdown();

    const html = render('<details><summary>点我看更多</summary>\n\n隐藏内容\n\n</details>');

    expect(html).toContain('<details>');
    expect(html).toContain('<summary>点我看更多</summary>');
    expect(render('<details open><summary>s</summary>内容</details>')).toContain('<details open>');
  });

  it('keeps inline semantic tags', () => {
    const { render } = useMarkdown();

    expect(render('按 <kbd>Ctrl</kbd> + <kbd>C</kbd> 复制')).toContain('<kbd>Ctrl</kbd>');
    expect(render('这是 <mark>高亮</mark>')).toContain('<mark>高亮</mark>');
    expect(render('H<sub>2</sub>O 与 x<sup>2</sup>')).toContain('<sub>2</sub>');
    expect(render('<abbr title="HTML">HTML</abbr>')).toContain('title="HTML"');
  });

  it('renders plain inline code without mangling', () => {
    const { render } = useMarkdown();

    expect(render('`useMarkdown()`')).toContain(
      '<code class="inline-code">useMarkdown()</code>',
    );
    expect(render('`src/modules/markdown/sanitizer.ts`')).toContain(
      'src/modules/markdown/sanitizer.ts',
    );
  });
});
