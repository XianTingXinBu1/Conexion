/**
 * 数学公式渲染（KaTeX）
 *
 * 为什么用「占位符 + 回填」而不是直接让 KaTeX 输出走 sanitizer：
 * KaTeX 生成的 HTML 依赖大量 inline style 做竖排定位（vlist 高度、字距等），
 * 而 sanitizer 的 per-tag 属性白名单会把这些 style 全部删掉，公式排版直接崩。
 * 与其为公式放宽整个清洗策略（那样用户 HTML 的 <span style="..."> 也会一起放行），
 * 不如让公式绕开 sanitizer：
 *
 *   1. 渲染前把 $...$ / $$...$$ 抽成占位符（纯文本，能安全穿过 marked 与 DOMPurify）
 *   2. marked 解析 → sanitize 清洗
 *   3. 清洗完成后，再把占位符替换成 KaTeX 生成的 HTML
 *
 * KaTeX 以 trust: false 运行（禁用 \href / \htmlClass / \includegraphics 等危险命令），
 * 公式中的其它文本均会被转义，因此回填的片段是受控的。
 */

import katex from 'katex';
import { mapNonCode } from './segments';

export interface MathItem {
  /** 占位符（在清洗后的 HTML 中被替换掉） */
  placeholder: string;
  /** KaTeX 生成的 HTML */
  html: string;
  /** 是否为块级公式（回填时整体替换 <p> 包裹） */
  display: boolean;
}

export interface ExtractedMath {
  content: string;
  items: MathItem[];
}

/** 块级公式：$$...$$ / \[...\] */
const BLOCK_DOLLAR_RE = /(?<!\\)\$\$([\s\S]+?)(?<!\\)\$\$/g;
const BLOCK_BRACKET_RE = /\\\[([\s\S]+?)\\\]/g;
/** 行内公式：$...$ / \(...\)；开 $ 后不能是空白，闭 $ 前不能是空白，且不跨行 */
const INLINE_DOLLAR_RE = /(?<!\\)\$(?!\s)([^\n$]+?)(?<!\s)(?<!\\)\$/g;
const INLINE_PAREN_RE = /\\\(([\s\S]+?)\\\)/g;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * 单个公式 → HTML
 */
function renderMathHtml(tex: string, display: boolean): string {
  let body: string;

  try {
    body = katex.renderToString(tex, {
      displayMode: display,
      throwOnError: false,
      strict: 'ignore',
      trust: false,
    });
  } catch {
    // 极端情况（非字符串 / KaTeX 内部异常）降级为原始文本
    body = `<code class="katex-error">${escapeHtml(tex)}</code>`;
  }

  return display ? `<div class="katex-block">${body}</div>` : body;
}

/**
 * 在非代码文本中提取公式，替换为占位符
 */
function replaceMath(text: string, items: MathItem[], nonce: string): string {
  if (!text) return text;

  const push = (tex: string, display: boolean): string => {
    const trimmed = tex.trim();
    const placeholder = `@@MATH-${nonce}-${items.length}@@`;
    items.push({ placeholder, html: renderMathHtml(trimmed, display), display });
    return placeholder;
  };

  let out = text;
  // 块级优先，避免 $$...$$ 被行内规则拆开
  out = out.replace(BLOCK_DOLLAR_RE, (_match, tex: string) => push(tex, true));
  out = out.replace(BLOCK_BRACKET_RE, (_match, tex: string) => push(tex, true));
  out = out.replace(INLINE_DOLLAR_RE, (_match, tex: string) => push(tex, false));
  out = out.replace(INLINE_PAREN_RE, (_match, tex: string) => push(tex, false));
  return out;
}

/**
 * 提取数学公式，返回带占位符的 Markdown 与公式清单
 *
 * 代码块与行内代码内的 $ 不会被视为公式（由 mapNonCode 保证）。
 */
export function extractMath(content: string): ExtractedMath {
  const hasCandidate = content.includes('$') || content.includes('\\(') || content.includes('\\[');
  if (!content || !hasCandidate) {
    return { content, items: [] };
  }

  const nonce = Math.random().toString(36).slice(2, 10);
  const items: MathItem[] = [];

  return {
    content: mapNonCode(content, (text) => replaceMath(text, items, nonce)),
    items,
  };
}

/**
 * 把占位符回填为 KaTeX HTML
 */
export function restoreMath(html: string, items: MathItem[]): string {
  if (!items.length) return html;

  let out = html;
  for (const item of items) {
    if (item.display) {
      const wrapped = `<p>${item.placeholder}</p>`;
      if (out.includes(wrapped)) {
        out = out.split(wrapped).join(item.html);
        continue;
      }
    }
    out = out.split(item.placeholder).join(item.html);
  }
  return out;
}
