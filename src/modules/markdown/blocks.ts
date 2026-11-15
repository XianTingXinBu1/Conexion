/**
 * 顶层块切分
 *
 * 为流式增量渲染提供「可缓存的最小单位」：把 Markdown 切成若干顶层块，
 * 前面的块一旦确定完成就不再重渲染，只有末尾还在增长的块需要每次重渲。
 *
 * 切点必须落在**真正的顶层块边界**上。以下位置的空行不能切，否则会把一个
 * 结构拆成两半、渲染出破损 HTML：
 *
 * - fenced code block（``` / ~~~）内部
 * - 未闭合的块级公式（$$…$$ / \[…\]）内部
 *
 * 不做的事情（刻意保守）：
 * - 不判断 loose list（列表项之间的空行会切成两个 <ul>）。流式过程中允许这种
 *   近似——最终态走整篇渲染（见 MarkdownRenderer 的 streaming 分支），所以
 *   用户看到的定稿永远是正确的。
 * - 不处理脚注与其它跨块依赖，那类内容整篇退化为全量渲染（见 incremental.ts）。
 */

/** fenced code block 起始行 */
const FENCE_LINE_RE = /^[ \t]*(`{3,}|~{3,})/;

export interface TopLevelBlocks {
  /** 已以空行结束的块，每块是完整的 Markdown 源文本（不含分隔空行） */
  blocks: string[];
  /** 末尾尚未以空行结束的部分；可能还在增长，调用方每次都应当重渲 */
  tail: string;
}

/** 统计子串出现次数（用于块级公式的闭合判断） */
function countOccurrences(text: string, needle: string): number {
  let count = 0;
  let index = text.indexOf(needle);
  while (index !== -1) {
    count += 1;
    index = text.indexOf(needle, index + needle.length);
  }
  return count;
}

/**
 * 内容里是否存在「跨块不安全」的语法
 *
 * 块级公式的定界符出现奇数次，意味着有一个公式还开着，此时任何空行都可能是
 * 公式内部——整篇不切块更安全。
 */
export function hasUnclosedDisplayMath(content: string): boolean {
  const dollar = countOccurrences(content, '$$');
  const bracketOpen = countOccurrences(content, '\\[');
  const bracketClose = countOccurrences(content, '\\]');

  return dollar % 2 === 1 || bracketOpen !== bracketClose;
}

/**
 * 把内容切成顶层块
 *
 * `blocks` 只包含已经以空行收尾的部分；剩下的全部放进 `tail`。
 * 两者拼接（`blocks.join('\n\n') + 分隔 + tail`）与原文语义一致，
 * 但**不保证逐字还原**——原文里的连续空行会被折叠，因此调用方不应依赖
 * 拼接结果做字符串比较（增量渲染只需要块源文本用于缓存比对）。
 */
export function splitTopLevelBlocks(content: string): TopLevelBlocks {
  const blocks: string[] = [];
  const lines = content.split('\n');
  let buffer: string[] = [];
  let fenceMarker: string | null = null;

  const flush = () => {
    if (!buffer.length) return;
    const text = buffer.join('\n');
    if (text.trim()) {
      blocks.push(text);
    }
    buffer = [];
  };

  for (const line of lines) {
    const marker = line.match(FENCE_LINE_RE)?.[1];

    if (fenceMarker) {
      buffer.push(line);
      // 闭合围栏：同类字符且长度不短于开启标记
      if (marker && marker[0] === fenceMarker[0] && marker.length >= fenceMarker.length) {
        fenceMarker = null;
      }
      continue;
    }

    if (marker) {
      fenceMarker = marker;
      buffer.push(line);
      continue;
    }

    if (line.trim() === '') {
      flush();
      continue;
    }

    buffer.push(line);
  }

  // 仍在围栏内的内容属于 tail（未闭合的代码块还在增长）
  const tail = buffer.join('\n');

  return { blocks, tail };
}
