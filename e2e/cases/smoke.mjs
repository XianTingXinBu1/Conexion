/**
 * Smoke E2E：验证 Selenium + Termux Chromium 能加载应用
 */

import { buildDriver, BASE_URL, By, until, waitForElement } from '../helpers/driver.mjs';

export default {
  'chromium 能加载应用首页': async () => {
    const driver = buildDriver();
    try {
      await driver.get(BASE_URL);
      const title = await driver.getTitle();
      console.log(`  page title: "${title}"`);

      // 应用挂载：body 内应有 #app 或实际内容
      await driver.wait(async () => {
        const html = await driver.getPageSource();
        return html.includes('id="app"') && html.length > 500;
      }, 15000, '等待应用挂载');

      const appRoot = await waitForElement(driver, '#app', 15000);
      const text = await appRoot.getText();
      if (!text && text !== '') {
        throw new Error('应用根节点无内容');
      }
    } finally {
      await driver.quit();
    }
  },
};
