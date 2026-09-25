/**
 * 脚注支持（`[^1]` 引用 + `[^1]: 内容` 定义）
 *
 * 为什么必须自己处理：
 * marked 不支持 GFM 脚注，会把 `[^1]: 脚注内容` 当成「引用式链接定义」，
 * 于是 `[^1]` 渲染成 `<a href="脚注内容">` —— 点击会跳到相对路径（404）。
 *
 * 实现选择「纯字符串预处理」而不是 marked 扩展：
 * 1. 移除定义行，把引用替换成 `<sup class="footnote-ref">[n]</sup>`
 * 2. 把脚注列表以 Markdown 文本追加到文末（`<div class="footnotes">` + 有序列表）
 * 这样脚注内容仍然会走正常的 marked 解析与 sanitizer 清洗，
 * 不需要为 `id` / `href="#fn-1"` 这类锚点放宽白名单
 * （锚点 id 在多条消息之间会重复，且属于 DOM clobbering 面）。
 */

import { mapNonCode, splitByFence } from './segments';

/** 定义行：`[^label]: 内容` */
const DEFINITION_RE = /^[ \t]*\[\^([^\]]+)\]:[ \t]*(.*)$/;
/** 定义续行（缩进，且不是新的定义行） */
const CONTINUATION_RE = /^(?: {2,}|\t)(.*)$/;
/** 引用：`[^label]` */
const REFERENCE_RE = /\[\^([^\]]+)\]/g;

export interface FootnoteExtraction {
  /** 移除定义行之后的内容 */
  content: string;
  /** label → 内容 */
  defs: Map<string, string>;
}

/**
 * 抽出定义行（含缩进续行）
 *
 * 代码块内的 `[^1]: ...` 不会被当成定义。
 */
export function extractFootnoteDefinitions(content: string): FootnoteExtraction {
  const defs = new Map<string, string>();

  if (!content.includes('[^')) {
    return { content, defs };
  }

  const outSegments = splitByFence(content).map((segment) => {
    if (segment.code) return segment.text;

    const keptLines: string[] = [];
    let currentLabel: string | null = null;

    for (const line of segment.text.split('\n')) {
      const definition = line.match(DEFINITION_RE);

      if (definition) {
        const label = definition[1] ?? '';
        currentLabel = label;
        defs.set(label, (definition[2] ?? '').trim());
        continue;
      }

      const continuation = currentLabel !== null ? line.match(CONTINUATION_RE) : null;
      if (continuation && currentLabel !== null) {
        const previous = defs.get(currentLabel) ?? '';
        const extra = (continuation[1] ?? '').trim();
        defs.set(currentLabel, `${previous} ${extra}`.trim());
        continue;
      }

      currentLabel = null;
      keptLines.push(line);
    }

    return keptLines.join('\n');
  });

  return { content: outSegments.join('\n'), defs };
}

/**
 * 把引用替换为上标标记，返回用到的 label 顺序
 */
function replaceReferences(content: string, defs: Map<string, string>): {
  content: string;
  used: string[];
} {
  const used: string[] = [];

  const transformed = mapNonCode(content, (text) =>
    text.replace(REFERENCE_RE, (match, label: string) => {
      if (!defs.has(label)) {
        // 没有定义时保持原样（marked 会渲染成普通文本）
        return match;
      }

      let index = used.indexOf(label);
      if (index === -1) {
        used.push(label);
        index = used.length - 1;
      }
      return `<sup class="footnote-ref">[${index + 1}]</sup>`;
    }),
  );

  return { content: transformed, used };
}

/**
 * 脚注总入口：处理定义与引用，并在文末追加脚注列表
 *
 * 返回的仍是 Markdown 文本（脚注列表用有序列表语法，交给 marked 解析与清洗）。
 */
export function transformFootnotes(content: string): string {
  const { content: body, defs } = extractFootnoteDefinitions(content);
  if (!defs.size) return content;

  const { content: withRefs, used } = replaceReferences(body, defs);
  if (!used.length) return withRefs;

  // 单换行分隔，保证所有条目属于同一个 <ol>（空行会拆成多个从 1 开始的列表）
  const items = used
    .map((label) => `1. ${defs.get(label) ?? ''}`)
    .join('\n');

  return `${withRefs}\n\n<div class="footnotes">\n\n${items}\n\n</div>`;
}
