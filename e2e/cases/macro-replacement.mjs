/**
 * 宏替换端到端验证
 *
 * 在真实浏览器环境里调用应用的系统提示词构建模块，
 * 验证 {{...}} 变量确实被替换、未识别变量原样保留。
 *
 * 这是对 macro.test.ts（单测）的补充：证明在 Vite 浏览器运行时下行为一致。
 */

import { buildDriver, BASE_URL, waitForVisible } from '../helpers/driver.mjs';

export default {
  '浏览器运行时下 {{char}} 等变量被正确替换': async () => {
    const driver = buildDriver();
    try {
      await driver.get(BASE_URL);
      await waitForVisible(driver, '#app', 15000);

      // 在页面上下文动态 import 应用模块并执行构建
      const result = await driver.executeAsyncScript(function (done) {
        (async () => {
          try {
            const mod = await import('/src/modules/system-prompt/index.ts');
            const now = new Date(2026, 6, 8, 13, 9, 45);

            const preset = {
              id: 'e2e-preset',
              name: 'E2E 预设',
              createdAt: 0,
              updatedAt: 0,
              items: [
                {
                  id: 'main',
                  name: '主提示词',
                  description: '',
                  enabled: true,
                  prompt: '你是{{char}}，请服务好{{user}}。身份：{{description}}。当前：{{date}} {{weekday}}。未知：{{unknown}}',
                  roleType: 'system',
                  insertPosition: 1,
                },
              ],
            };

            const aiCharacter = {
              id: 'ai-1', name: '小助手', description: '负责回答问题',
              personality: '友好', createdAt: 0,
            };
            const userCharacter = {
              id: 'user-1', name: '小明', description: '测试用户', createdAt: 0,
            };

            const built = mod.buildSystemPrompt({
              preset, aiCharacter, userCharacter,
              knowledgeBases: [], chatHistory: [],
              mergeMode: 'none', now,
            });

            done({ ok: true, messages: built.messages });
          } catch (err) {
            done({ ok: false, error: String(err && err.message ? err.message : err) });
          }
        })();
      });

      if (!result.ok) {
        throw new Error(`构建失败: ${result.error}`);
      }

      const content = result.messages.map(m => m.content).join('\n');

      if (content.includes('{{char}}') || content.includes('{{user}}') || content.includes('{{date}}')) {
        throw new Error(`变量未被替换，实际内容: ${content}`);
      }
      if (!content.includes('小助手')) throw new Error(`未替换 {{char}}：${content}`);
      if (!content.includes('小明')) throw new Error(`未替换 {{user}}：${content}`);
      if (!content.includes('负责回答问题')) throw new Error(`未替换 {{description}}：${content}`);
      if (!content.includes('2026-07-08')) throw new Error(`未替换 {{date}}：${content}`);
      if (!content.includes('星期三')) throw new Error(`未替换 {{weekday}}：${content}`);
      if (!content.includes('{{unknown}}')) throw new Error(`未知变量应原样保留：${content}`);
    } finally {
      await driver.quit();
    }
  },
};
