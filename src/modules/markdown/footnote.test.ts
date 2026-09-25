import { describe, it, expect } from 'vitest';
import { extractFootnoteDefinitions, transformFootnotes } from './footnote';

describe('footnote definitions', () => {
  it('extracts definitions and removes them from the body', () => {
    const { content, defs } = extractFootnoteDefinitions('正文[^1]\n\n[^1]: 脚注内容');

    expect(defs.get('1')).toBe('脚注内容');
    expect(content).not.toContain('[^1]:');
    expect(content).toContain('正文[^1]');
  });

  it('joins indented continuation lines', () => {
    const { defs } = extractFootnoteDefinitions('a[^x]\n\n[^x]: 第一行\n  第二行\n    第三行');

    expect(defs.get('x')).toBe('第一行 第二行 第三行');
  });

  it('leaves content untouched when there is no definition', () => {
    const source = '只有引用[^n] 没有定义';
    const { content, defs } = extractFootnoteDefinitions(source);

    expect(defs.size).toBe(0);
    expect(content).toBe(source);
  });

  it('does not touch definitions inside code blocks', () => {
    // 定义行写在代码块里时不应当被识别（这里只验证引用替换阶段的代码保护）
    const html = transformFootnotes('```\n[^1]: 代码里的\n```\n\n正文[^1]');

    expect(html).toContain('[^1]: 代码里的');
  });
});

describe('footnote rendering', () => {
  it('replaces references with superscript markers', () => {
    const html = transformFootnotes('正文[^1] 与再次引用[^1]\n\n[^1]: 内容');

    expect(html).toContain('<sup class="footnote-ref">[1]</sup>');
    // 同一个 label 复用同一个编号
    expect(html.match(/footnote-ref/g)).toHaveLength(2);
    expect(html).toContain('<div class="footnotes">');
  });

  it('numbers footnotes in order of first reference', () => {
    const html = transformFootnotes('a[^b] c[^a]\n\n[^a]: A\n[^b]: B');

    expect(html).toContain('<sup class="footnote-ref">[1]</sup>');
    expect(html).toContain('<sup class="footnote-ref">[2]</sup>');
    // 未定义的引用保持原样
    expect(transformFootnotes('x[^none]\n\n[^y]: Y')).toContain('[^none]');
  });

  it('keeps references inside code spans literal', () => {
    const html = transformFootnotes('`[^1]` 与 [^1]\n\n[^1]: 内容');

    expect(html).toContain('`[^1]`');
    expect(html.match(/footnote-ref/g)).toHaveLength(1);
  });

  it('omits the footnote list when nothing is referenced', () => {
    const html = transformFootnotes('正文\n\n[^1]: 未被引用');

    expect(html).not.toContain('<div class="footnotes">');
    expect(html).not.toContain('[^1]:');
  });
});
