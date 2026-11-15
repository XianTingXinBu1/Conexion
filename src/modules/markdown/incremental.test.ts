// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { useMarkdown } from './useMarkdown';
import { splitTopLevelBlocks, hasUnclosedDisplayMath } from './blocks';
import { IncrementalMarkdownRenderer } from './incremental';

const PARAGRAPHS = [
  '第一段用来测试增量渲染的块切分。',
  '第二段带 **加粗** 与 `行内代码`。',
  '第三段带一个列表：\n\n- 甲\n- 乙',
  '第四段带代码块：\n\n```ts\nconst a = 1;\n```',
  '第五段收尾。',
];

function joined(count: number): string {
  return PARAGRAPHS.slice(0, count).join('\n\n');
}

/** 模拟流式到达：逐字符推送，每 step 个字符取一次快照 */
function streamSnapshots(source: string, step: number): string[] {
  const snapshots: string[] = [];
  for (let index = step; index <= source.length; index += step) {
    snapshots.push(source.slice(0, index));
  }
  snapshots.push(source);
  return snapshots;
}

describe('splitTopLevelBlocks', () => {
  it('cuts on blank lines between top-level blocks', () => {
    const { blocks, tail } = splitTopLevelBlocks('a\n\nb\n\nc');

    expect(blocks).toEqual(['a', 'b']);
    expect(tail).toBe('c');
  });

  it('keeps blank lines inside a fenced code block in one piece', () => {
    const source = '前言\n\n```ts\nconst a = 1;\n\nconst b = 2;\n```\n\n结尾';
    const { blocks, tail } = splitTopLevelBlocks(source);

    expect(blocks).toHaveLength(2);
    expect(blocks[1]).toContain('const b = 2;');
    expect(blocks[1]!.startsWith('```ts')).toBe(true);
    expect(tail).toBe('结尾');
  });

  it('treats an unclosed fence as growing tail', () => {
    const { blocks, tail } = splitTopLevelBlocks('已完成段落\n\n```ts\n未闭合\n\n还能继续');

    expect(blocks).toEqual(['已完成段落']);
    expect(tail.startsWith('```ts')).toBe(true);
  });

  it('detects unclosed display math', () => {
    expect(hasUnclosedDisplayMath('$$x$$')).toBe(false);
    expect(hasUnclosedDisplayMath('$$\nx\n$$')).toBe(false);
    expect(hasUnclosedDisplayMath('$$\nx\n')).toBe(true);
    expect(hasUnclosedDisplayMath('\\[x\\]')).toBe(false);
    expect(hasUnclosedDisplayMath('\\[x')).toBe(true);
  });
});

describe('IncrementalMarkdownRenderer', () => {
  // 只用不 sanitize 的 render 做等价性断言：happy-dom 下的 DOMPurify 会剥掉标签
  // （项目文档已记录「DOM 级断言在 happy-dom 是假阳性」），用 renderSafe 比较
  // 完整 HTML 字符串会得到与浏览器不一致的结果。
  let renderMarkdown: (content: string) => string;

  beforeEach(() => {
    const { reset, render } = useMarkdown();
    reset();
    renderMarkdown = render;
  });

  it('produces the same html as a whole-document render for plain content', () => {
    const renderer = new IncrementalMarkdownRenderer(renderMarkdown);
    const source = joined(PARAGRAPHS.length);

    const { blocks } = renderer.render(source);
    const incremental = blocks.map((block) => block.html).join('');

    expect(incremental).toBe(renderMarkdown(source));
  });

  it('matches whole-document render at every streaming snapshot', () => {
    const renderer = new IncrementalMarkdownRenderer(renderMarkdown);
    const source = joined(PARAGRAPHS.length);

    for (const snapshot of streamSnapshots(source, 7)) {
      const { blocks } = renderer.render(snapshot);
      const incremental = blocks.map((block) => block.html).join('');

      expect(incremental).toBe(renderMarkdown(snapshot));
    }
  });

  it('reuses finished blocks instead of re-rendering the whole reply', () => {
    const renderer = new IncrementalMarkdownRenderer(renderMarkdown);
    const source = joined(PARAGRAPHS.length);

    let fullRenderChars = 0;
    let incrementalChars = 0;
    let lastReused = 0;

    for (const snapshot of streamSnapshots(source, 5)) {
      const { renderedChars, reusedBlocks } = renderer.render(snapshot);
      fullRenderChars += snapshot.length;
      incrementalChars += renderedChars;
      lastReused = reusedBlocks;
    }

    // 最终一轮：前四个块应已缓存，只重渲尾部
    expect(lastReused).toBeGreaterThanOrEqual(4);
    // 累计渲染字符数应远小于「每轮全量」——留足余量，避免断言脆弱
    expect(incrementalChars).toBeLessThan(fullRenderChars * 0.5);
  });

  it('keeps finished block keys stable across flushes', () => {
    const renderer = new IncrementalMarkdownRenderer(renderMarkdown);

    const first = renderer.render(joined(2)).blocks;
    const second = renderer.render(`${joined(2)}\n\n新增段落的内容`).blocks;

    // 第一个块（含其 html）必须原样复用，否则 Vue 会重建 DOM
    expect(second[0]).toEqual(first[0]);
    // 上一轮的末尾块成为完成块时，key 必须延续（否则那一块也会重建）
    expect(second[1]).toEqual(first[1]);
    expect(first[1]!.key).toBeLessThan(0);

    const newTail = second[second.length - 1]!;
    expect(newTail.key).toBeLessThan(0);
    expect(newTail.key).not.toBe(second[1]!.key);
  });

  it('falls back to a whole-document render when footnotes are present', () => {
    const renderer = new IncrementalMarkdownRenderer(renderMarkdown);
    const source = '正文引用[^1]\n\n第二段\n\n[^1]: 脚注内容';

    const { blocks, renderedChars } = renderer.render(source);

    expect(blocks).toHaveLength(1);
    expect(renderedChars).toBe(source.length);
    expect(blocks[0]!.html).toBe(renderMarkdown(source));
  });

  it('falls back when display math spans a blank line', () => {
    const renderer = new IncrementalMarkdownRenderer(renderMarkdown);
    const source = '$$\na\n\nb\n$$';

    const { blocks, renderedChars } = renderer.render(source);

    expect(blocks).toHaveLength(1);
    expect(renderedChars).toBe(source.length);
  });

  it('resets to empty when content becomes empty', () => {
    const renderer = new IncrementalMarkdownRenderer(renderMarkdown);

    renderer.render('一段内容');
    const { blocks, renderedChars } = renderer.render('');

    expect(blocks).toEqual([]);
    expect(renderedChars).toBe(0);
  });
});
