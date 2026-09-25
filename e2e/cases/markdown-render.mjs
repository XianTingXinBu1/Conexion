/**
 * Markdown 渲染与消毒 E2E
 *
 * 为什么放在 E2E：
 * DOMPurify 3.4.13 在 happy-dom 下连 `<p>x</p>` 都解析不出标签
 * （原生调用同样如此），DOM 级断言在单测环境不可信，只能在真实 Chromium 验证。
 *
 * 覆盖：
 * - 行内代码渲染（回归：曾因 marked renderer 回调签名变更输出 [object Object]）
 * - per-tag 属性白名单（<p href> 不该保留 href）
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
  '    });',
  '  } catch (err) {',
  '    done({ error: String((err && err.stack) || err) });',
  '  }',
  '})();',
].join('\n');

export default {
  'Markdown 渲染：行内代码 / 属性白名单 / 链接硬化': async () => {
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
