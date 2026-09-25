/**
 * 代码区域感知的文本处理
 *
 * 公式、脚注这类「预处理语法」必须在渲染前做字符串替换，
 * 但不能动代码块（``` / ~~~）与行内代码（`...`）里的内容，
 * 否则 `$x$` / `[^1]` 会被误当成公式或脚注。
 *
 * 因此这里提供统一的「按代码区域切分 / 只处理非代码片段」入口。
 */

/** fenced code block 起始行 */
const FENCE_LINE_RE = /^[ \t]*(`{3,}|~{3,})/;
/** 行内代码 */
const INLINE_CODE_RE = /(`+)([\s\S]*?)\1/g;

export interface ContentSegment {
  text: string;
  /** true 表示这段是 fenced code block（含围栏行本身） */
  code: boolean;
}

/**
 * 按 fenced code block 把内容切成若干段
 *
 * 段之间用 '\n' 重新拼接即可无损还原原文（原文本身就是按行拼接的）。
 */
export function splitByFence(content: string): ContentSegment[] {
  const segments: ContentSegment[] = [];
  const lines = content.split('\n');
  let buffer: string[] = [];
  let fenceMarker: string | null = null;
  let inFence = false;

  const flush = () => {
    if (!buffer.length) return;
    segments.push({ text: buffer.join('\n'), code: inFence });
    buffer = [];
  };

  for (const line of lines) {
    if (fenceMarker) {
      buffer.push(line);
      const marker = line.match(FENCE_LINE_RE)?.[1];
      if (marker && marker[0] === fenceMarker[0] && marker.length >= fenceMarker.length) {
        fenceMarker = null;
        // 必须先 flush（此时 inFence 仍为 true，代码段才会被正确标记）
        flush();
        inFence = false;
      }
      continue;
    }

    const opening = line.match(FENCE_LINE_RE)?.[1];
    if (opening) {
      flush();
      inFence = true;
      fenceMarker = opening;
      buffer.push(line);
      continue;
    }

    buffer.push(line);
  }

  flush();
  return segments;
}

/**
 * 只对非代码片段应用 transform，其余原样保留。
 *
 * 连续的非 fence 行会合并成一段再处理（保证跨行语法，如块级公式 $$...$$ 完整可见）。
 */
export function mapNonCode(content: string, transform: (text: string) => string): string {
  return splitByFence(content)
    .map((segment) => (segment.code ? segment.text : applyToNonCode(segment.text, transform)))
    .join('\n');
}

/**
 * 按行内代码切分，只处理代码之外的片段
 */
function applyToNonCode(text: string, transform: (text: string) => string): string {
  let result = '';
  let lastIndex = 0;

  INLINE_CODE_RE.lastIndex = 0;
  for (const match of text.matchAll(INLINE_CODE_RE)) {
    const start = match.index ?? 0;
    result += transform(text.slice(lastIndex, start));
    result += match[0];
    lastIndex = start + match[0].length;
  }
  result += transform(text.slice(lastIndex));
  return result;
}
