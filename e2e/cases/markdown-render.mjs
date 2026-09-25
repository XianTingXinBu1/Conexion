/**
 * Markdown 渲染与消毒 E2E
 *
 * 为什么放在 E2E：
 * DOMPurify 3.4.13 在 happy-dom 下连 `<p>x</p>` 都解析不出标签
 * （原生调用同样如此），DOM 级断言在单测环境不可信，只能在真实 Chromium 验证。
 *
 * 覆盖：
 * - 行内代码渲染（回归：曾因 marked renderer 回调签名变更输出 [object Object]）
 * - 链接文本内的行内 markdown（回归：曾因直接插值 token.text 显示字面量 ** / `）
 * - per-tag 属性白名单（<p href> 不该保留 href；.code-wrapper 的 class 必须保留）
 * - 任务列表复选框保留，但可交互 input 被移除
 * - KaTeX 数学公式（含行内 style 存活与货币符号不误判）
 * - 危险协议拦截、外部链接硬化、img 懒加载属性保留
 */

import { buildDriver, BASE_URL } from '../helpers/driver.mjs';

const PROBE_SCRIPT = [
  'const done = arguments[arguments.length - 1];',
  '(async () => {',
  '  try {',
  "    const mod = await import('/src/modules/markdown/index.ts');",
  '    const { useMarkdown } = mod;',
  '    const { render, renderSafe, reset } = useMarkdown();',
  '    reset();',
  '    done({',
  "      inlineCode: render('`foo()`'),",
  "      inlineCodeEscaped: render('`<b>x</b>`'),",
  "      codeBlock: render('```js\\nconst a = 1\\n```'),",
  '      pWithHref: renderSafe(\'<p href="evil">x</p>\'),',
  "      pWithOnclick: renderSafe('<p onclick=\"alert(1)\">x</p>'),",
  "      jsLink: renderSafe('[x](javascript:alert(1))'),",
  "      normalLink: renderSafe('[safe](https://example.com)'),",
  "      imgLazy: renderSafe('![a](https://example.com/a.png)'),",
  "      linkBold: renderSafe('[**bold**](https://example.com)'),",
  "      linkCode: renderSafe('[`code`](https://example.com)'),",
  "      codeWrapper: renderSafe('```js\\nconst a = 1\\n```'),",
  "      taskList: renderSafe('- [x] done\\n- [ ] todo'),",
  "      evilInput: renderSafe('<input type=\"text\" name=\"x\">'),",
  "      mathInline: renderSafe('$E=mc^2$'),",
  "      mathBlock: renderSafe('$$\\n\\\\int_0^1 x\\\\,dx\\n$$'),",
  "      mathMoney: renderSafe('价格是 $5 和 $10'),",
  "      mathInCode: renderSafe('`$x$`'),",
  "      mathXss: renderSafe('$\\\\href{javascript:alert(1)}{x}$'),",
  "      details: renderSafe('<details><summary>点我看更多</summary>\\n\\n隐藏内容\\n\\n</details>'),",
  "      detailsOpen: renderSafe('<details open><summary>默认展开</summary>内容</details>'),",
  "      kbdMark: renderSafe('按 <kbd>Ctrl</kbd> 与 <mark>高亮</mark>'),",
  "      footnote: renderSafe('正文[^1]\\n\\n[^1]: 脚注内容'),",
  "      footnoteNoDef: renderSafe('只有引用[^none] 无定义'),",
  '      detailsToggle: (() => {',
  '        // host 需要带上容器类，容器内的 CSS（cursor 等）才会生效',
  "        const host = document.createElement('div');",
  "        host.className = 'markdown-renderer';",
  "        host.innerHTML = renderSafe('<details><summary>t</summary>\\n\\nbody\\n\\n</details>');",
  '        document.body.appendChild(host);',
  "        const d = host.querySelector('details');",
  "        const s = host.querySelector('summary');",
  '        const before = d ? d.open : null;',
  '        if (s) s.click();',
  '        const after = d ? d.open : null;',
  '        const cursor = s ? getComputedStyle(s).cursor : null;',
  '        host.remove();',
  '        return { exists: !!d, hasSummary: !!s, before, after, cursor };',
  '      })(),',
  '      mathFont: (() => {',
  "        const host = document.createElement('div');",
  "        host.innerHTML = renderSafe('$x$');",
  '        document.body.appendChild(host);',
  "        const el = host.querySelector('.katex');",
  '        const font = el ? getComputedStyle(el).fontFamily : null;',
  '        host.remove();',
  '        return font;',
  '      })(),',
  '    });',
  '  } catch (err) {',
  '    done({ error: String((err && err.stack) || err) });',
  '  }',
  '})();',
].join('\n');

export default {
  'Markdown 渲染：行内代码 / 属性白名单 / 链接硬化 / 数学公式': async () => {
    const driver = buildDriver();
    try {
      await driver.get(BASE_URL);

      const r = await driver.executeAsyncScript(PROBE_SCRIPT);

      if (r.error) {
        throw new Error(`页面内探针执行失败：${r.error}`);
      }

      const fail = (msg) => {
        throw new Error(`${msg}\n实际结果：${JSON.stringify(r, null, 2)}`);
      };

      // 1. 行内代码：必须渲染成字面量，且不能出现 [object Object]
      if (!r.inlineCode.includes('<code class="inline-code">foo()</code>')) {
        fail('行内代码未正确渲染');
      }
      if (r.inlineCode.includes('[object Object]') || r.inlineCodeEscaped.includes('[object Object]')) {
        fail('行内代码出现 [object Object]（renderer 回调签名回归）');
      }
      if (!r.inlineCodeEscaped.includes('&lt;b&gt;x&lt;/b&gt;')) {
        fail('行内代码未转义，<b> 被当作 HTML 解析');
      }
      if (!r.codeBlock.includes('const a = 1')) {
        fail('代码块渲染异常');
      }

      // 2. per-tag 属性白名单：p 未声明任何属性，href/onclick 都该被移除
      if (r.pWithHref.includes('href')) {
        fail('per-tag 收紧失效：<p href> 的 href 被保留');
      }
      if (r.pWithOnclick.includes('onclick')) {
        fail('事件属性未被移除');
      }

      // 2b. 代码块包装层 class 必须保留（CSS 靠它做横向滚动）
      if (!r.codeWrapper.includes('class="code-wrapper"')) {
        fail('代码块的 .code-wrapper class 被误删，长代码行无法横向滚动');
      }

      // 2c. 链接文本内的行内 markdown 必须真正渲染
      if (!r.linkBold.includes('<strong>bold</strong>')) {
        fail('链接文本内的 **加粗** 未渲染（renderer.link 未 parseInline）');
      }
      if (!r.linkCode.includes('<code')) {
        fail('链接文本内的行内代码未渲染');
      }

      // 2d. 任务列表复选框保留，可交互 input 被移除
      if (!r.taskList.includes('type="checkbox"') || !r.taskList.includes('disabled')) {
        fail('任务列表复选框未保留');
      }
      if (r.evilInput.includes('input')) {
        fail('可交互 input 未被移除');
      }

      // 3b. 数学公式：KaTeX 输出必须完整存活（回填发生在 sanitize 之后）
      if (!r.mathInline.includes('class="katex"') || !r.mathInline.includes('katex-html')) {
        fail('行内公式未渲染为 KaTeX');
      }
      if (!r.mathInline.includes('style="')) {
        fail('KaTeX 的 inline style 丢失（回填顺序错误或走了 sanitizer）');
      }
      if (!r.mathBlock.includes('class="katex-block"') || r.mathBlock.includes('<p>')) {
        fail('块级公式未替换整个段落');
      }
      if (r.mathMoney.includes('katex') || r.mathInCode.includes('katex')) {
        fail('货币符号或行内代码里的 $ 被误判为公式');
      }
      if (r.mathXss.includes('<a ')) {
        fail('trust: false 下 \\href 不应生成链接');
      }
      if (!r.mathFont || !r.mathFont.includes('KaTeX')) {
        fail(`KaTeX 样式未生效，公式字体为：${r.mathFont}`);
      }

      // 3c. 折叠块（<details>/<summary>）必须保留且真的能折叠
      if (!r.details.includes('<details>') || !r.details.includes('<summary>')) {
        fail('折叠块 <details>/<summary> 被 sanitizer 剥掉');
      }
      if (!r.detailsOpen.includes('open')) {
        fail('<details open> 的 open 属性被移除');
      }
      if (!r.detailsToggle.exists || !r.detailsToggle.hasSummary) {
        fail('折叠块未渲染为真实元素');
      }
      if (r.detailsToggle.before !== false || r.detailsToggle.after !== true) {
        fail(`折叠交互异常：点击前 open=${r.detailsToggle.before}，点击后 open=${r.detailsToggle.after}`);
      }
      if (r.detailsToggle.cursor !== 'pointer') {
        fail(`summary 未显示为可点击，cursor=${r.detailsToggle.cursor}`);
      }
      if (!r.kbdMark.includes('<kbd>') || !r.kbdMark.includes('<mark>')) {
        fail('内联语义标签（kbd/mark）被移除');
      }

      // 3d. 脚注：必须渲染成上标标记 + 文末列表，而不是错误的引用式链接
      if (!r.footnote.includes('footnote-ref') || !r.footnote.includes('class="footnotes"')) {
        fail('脚注未渲染为标记 + 列表');
      }
      if (r.footnote.includes('href="脚注内容"') || r.footnote.includes('[^1]:')) {
        fail('脚注定义仍被当成引用式链接（会生成指向相对路径的错误链接）');
      }
      if (!r.footnoteNoDef.includes('[^none]')) {
        fail('无定义的脚注引用应保持原样文本');
      }

      // 3. 危险协议
      if (r.jsLink.includes('javascript:')) {
        fail('javascript: 协议未被拦截');
      }

      // 4. 外部链接硬化
      if (!r.normalLink.includes('target="_blank"') || !r.normalLink.includes('rel="noopener noreferrer"')) {
        fail('外部链接未补齐 target/rel');
      }

      // 5. img 懒加载属性（白名单漏了 loading 会在这里暴露）
      if (!r.imgLazy.includes('loading="lazy"')) {
        fail('img 的 loading="lazy" 丢失（属性白名单缺 loading）');
      }
    } finally {
      await driver.quit();
    }
  },
};
