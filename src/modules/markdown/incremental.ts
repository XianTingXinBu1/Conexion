/**
 * 流式增量 Markdown 渲染
 *
 * 问题：流式回复每 50~80ms 收到一小片文本，若每次都把**全文**重新走一遍
 * marked + KaTeX + DOMPurify 再整块替换 `v-html`，开销随回复长度线性增长。
 * 实测长回复单轮约 30~45ms 渲染 + 30~57ms DOM 重建，主线程占用过半，表现为
 * 输出一卡一卡。
 *
 * 做法：把内容切成顶层块（见 blocks.ts），已完成的块渲染结果按「源文本」缓存，
 * 只有新增块与末尾还在增长的块需要重新渲染。缓存的块以稳定 key 返回，
 * 上层用 `v-for` + 每块一个 `v-html` 渲染，于是前面块的 DOM 完全不动，
 * 连整块替换的成本也一起去掉了。
 *
 * 正确性边界：
 * - 含脚注（`[^x]`）时跨块依赖，整篇退化为全量渲染
 * - 块级公式未闭合、或公式自身跨空行时同样退化（切开会把公式拆成两半）
 * - 流式过程中的 loose list（列表项之间有空行）可能被切成两个 <ul>；
 *   最终态由上层切回整篇渲染修正，所以定稿永远正确
 */

import { hasUnclosedDisplayMath, splitTopLevelBlocks } from './blocks';

/** 末尾尚未完成的块使用的起始 key（逐次下移，保持每个块唯一） */
const FIRST_TAIL_KEY = -1;

/** 块级公式（$$…$$ / \[…\]） */
const DISPLAY_MATH_RE = /\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]/g;
/** 空行（允许行内空白） */
const BLANK_LINE_RE = /\n[ \t]*\n/;

export interface IncrementalBlock {
  /** 稳定的渲染 key：已完成的块不变，末尾块固定为 -1 */
  key: number;
  html: string;
}

export interface IncrementalRenderResult {
  blocks: IncrementalBlock[];
  /** 本轮实际交给 Markdown 渲染器的字符数（测试用这个做确定性断言） */
  renderedChars: number;
  /** 复用的已完成块数量 */
  reusedBlocks: number;
}

interface CachedBlock {
  src: string;
  html: string;
  key: number;
}

/**
 * 判断是否必须整篇渲染
 *
 * 这几种语法一旦切块就会渲染错，宁可慢也不能输出破损 HTML。
 */
function needsWholeDocument(content: string): boolean {
  // 脚注：引用与定义常常分处不同块，切开后引用会退化成普通文本
  if (content.includes('[^')) {
    return true;
  }

  if (hasUnclosedDisplayMath(content)) {
    return true;
  }

  // 块级公式自身跨空行：切点会落在公式内部
  for (const match of content.matchAll(DISPLAY_MATH_RE)) {
    if (BLANK_LINE_RE.test(match[0])) {
      return true;
    }
  }

  return false;
}

export class IncrementalMarkdownRenderer {
  private cache: CachedBlock[] = [];
  private nextKey = 0;
  /** 当前末尾块使用的 key；尾部升级为完成块时把它让出去，自己换下一个负数 */
  private tailKey = FIRST_TAIL_KEY;
  /** 上一轮末尾块的源文本：用于识别「这一轮的某个块就是上轮的尾部」 */
  private previousTailSrc = '';
  private readonly renderMarkdown: (source: string) => string;

  /**
   * @param renderMarkdown 整篇渲染函数（通常是 useMarkdown 的 renderSafe）
   */
  constructor(renderMarkdown: (source: string) => string) {
    this.renderMarkdown = renderMarkdown;
  }

  reset(): void {
    this.cache = [];
    this.nextKey = 0;
    this.tailKey = FIRST_TAIL_KEY;
    this.previousTailSrc = '';
  }

  render(content: string): IncrementalRenderResult {
    if (!content) {
      this.reset();
      return { blocks: [], renderedChars: 0, reusedBlocks: 0 };
    }

    if (needsWholeDocument(content)) {
      const html = this.renderMarkdown(content);
      const key = this.nextKey++;
      this.cache = [{ src: content, html, key }];
      this.previousTailSrc = '';

      return {
        blocks: [{ key, html }],
        renderedChars: content.length,
        reusedBlocks: 0,
      };
    }

    const { blocks, tail } = splitTopLevelBlocks(content);

    // 缓存命中的前提是「源文本逐字相同」：只要内容变了就必须重渲，
    // 不能按块序号猜。
    let reuse = 0;
    while (
      reuse < this.cache.length
      && reuse < blocks.length
      && this.cache[reuse]!.src === blocks[reuse]
    ) {
      reuse += 1;
    }

    const nextCache: CachedBlock[] = this.cache.slice(0, reuse);
    let renderedChars = 0;

    for (let index = reuse; index < blocks.length; index += 1) {
      const src = blocks[index]!;
      const html = this.renderMarkdown(src);
      renderedChars += src.length;

      // 上一轮的末尾块这一轮变成了完成块：沿用它的 key，那个 DOM 节点就不用重建。
      // 只可能发生在复用边界上（index === reuse），更靠后的块一定是新内容。
      const upgradedFromTail = index === reuse
        && this.previousTailSrc !== ''
        && src === this.previousTailSrc;
      const key = upgradedFromTail ? this.takeTailKey() : this.nextKey++;

      nextCache.push({ src, html, key });
    }

    this.cache = nextCache;

    const result: IncrementalBlock[] = this.cache.map((block) => ({
      key: block.key,
      html: block.html,
    }));

    if (tail.trim()) {
      const html = this.renderMarkdown(tail);
      renderedChars += tail.length;
      result.push({ key: this.tailKey, html });
    }

    this.previousTailSrc = tail.trim() ? tail : '';

    return {
      blocks: result,
      renderedChars,
      reusedBlocks: reuse,
    };
  }

  /** 把当前尾部 key 让给刚升级的块，尾部换用下一个负数 */
  private takeTailKey(): number {
    const key = this.tailKey;
    this.tailKey -= 1;
    return key;
  }
}
