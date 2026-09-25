import { describe, it, expect } from 'vitest';
import { extractMath, restoreMath } from './math';

describe('math extraction', () => {
  it('extracts inline and block formulas into placeholders', () => {
    const { content, items } = extractMath('质能方程 $E=mc^2$ 很重要\n\n$$\n\\int_0^1 x\\,dx\n$$');

    expect(items).toHaveLength(2);

    // 提取顺序为「块级优先」（避免 $$ 被行内规则拆开），用 display 区分而非下标
    const inline = items.find((item) => !item.display);
    const block = items.find((item) => item.display);

    expect(inline).toBeDefined();
    expect(block).toBeDefined();
    expect(inline?.html).toContain('class="katex"');
    expect(block?.html).toContain('class="katex-block"');
    // 占位符是纯文本，公式本身不该留在文本里
    expect(content).not.toContain('$');
    expect(content).toContain(inline?.placeholder ?? '');
  });

  it('supports \\(...\\) and \\[...\\] delimiters', () => {
    const { items } = extractMath('行内 \\(a+b\\)\n\n\\[c^2\\]');

    expect(items).toHaveLength(2);
    expect(items.filter((item) => !item.display)).toHaveLength(1);
    expect(items.filter((item) => item.display)).toHaveLength(1);
  });

  it('ignores dollar signs that are not formulas', () => {
    expect(extractMath('价格是 $5 和 $10').items).toHaveLength(0);
    expect(extractMath('\\$5 转义').items).toHaveLength(0);
    expect(extractMath('单个 $ 符号').items).toHaveLength(0);
  });

  it('does not touch inline code or fenced code blocks', () => {
    expect(extractMath('`$x$` 保持原样').items).toHaveLength(0);
    expect(extractMath('```\n$y$\n```').items).toHaveLength(0);
    expect(extractMath('~~~\n$z$\n~~~').items).toHaveLength(0);
  });

  it('restores placeholders into katex html', () => {
    const { content, items } = extractMath('$x$');
    const html = restoreMath(`<p>${content}</p>`, items);

    expect(html).toContain('class="katex"');
    expect(html).not.toContain('@@MATH');
  });

  it('replaces the whole paragraph for block formulas', () => {
    const { content, items } = extractMath('$$\na+b\n$$');
    const html = restoreMath(`<p>${content}</p>`, items);

    expect(html).toContain('class="katex-block"');
    expect(html).not.toContain('<p>');
  });

  it('degrades gracefully when the formula is invalid', () => {
    const { items } = extractMath('$\\frac{1}{$');

    expect(items).toHaveLength(1);
    expect(items[0]?.html).toContain('katex-error');
  });

  it('does not emit links for trust-disabled commands', () => {
    const { items } = extractMath('$\\href{javascript:alert(1)}{x}$');

    // trust: false 下 \href 不会生成 <a>，只把命令名当普通文本输出
    expect(items[0]?.html).not.toContain('<a ');
  });
});
