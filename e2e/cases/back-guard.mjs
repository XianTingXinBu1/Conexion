/**
 * 系统返回键（安卓返回 / 浏览器后退）行为 E2E
 *
 * 覆盖历史 bug：覆盖层（全屏编辑页、弹窗）打开时按返回，
 * 会直接离开当前页面回到上一页，而不是先关掉覆盖层。
 *
 * 这里用 driver.navigate().back() 模拟返回键，是真实浏览器行为。
 */

import { buildDriver, BASE_URL, By, until, waitForVisible } from '../helpers/driver.mjs';

const ROLE_URL = `${BASE_URL}/#/role-management`;

async function editorIsPresent(driver) {
  const editors = await driver.findElements(By.css('[data-testid="character-editor"]'));
  return editors.length > 0;
}

export default {
  '新建角色弹窗返回只关闭弹窗，导入入口在弹窗内，卡片高度统一': async () => {
    const driver = buildDriver();
    try {
      await driver.get(ROLE_URL);
      await waitForVisible(driver, '.role-management-page', 15000);
      await driver.findElement(By.css('.tab-btn:last-child')).click();
      const before = await driver.findElements(By.css('.create-option'));
      if (before.length) throw new Error('新建选项未收进弹窗');
      const navButtons = await driver.findElements(By.css('.nav-btn'));
      await navButtons[navButtons.length - 1].click();
      await waitForVisible(driver, '[data-testid="create-character-manually"]', 10000);
      const options = await driver.findElements(By.css('.create-option'));
      if (options.length !== 2 || !(await options[1].getText()).includes('导入角色卡')) throw new Error('新建弹窗缺少导入入口');
      await driver.navigate().back();
      await driver.wait(async () => (await driver.findElements(By.css('.create-option'))).length === 0, 10000);
      if (!(await driver.getCurrentUrl()).includes('/role-management')) throw new Error('返回键离开角色管理页');
      const sizes = await driver.executeScript(() => Array.from(document.querySelectorAll('.character-card')).map(el => el.getBoundingClientRect().height));
      if (sizes.some(height => Math.abs(height - 72) > 1)) throw new Error(`角色卡高度不统一: ${sizes}`);
    } finally { await driver.quit(); }
  },
  '编辑角色时按返回键只关闭编辑器，不离开角色管理页': async () => {
    const driver = buildDriver();
    try {
      await driver.get(ROLE_URL);
      await waitForVisible(driver, '.role-management-page', 15000);

      // 打开新建角色编辑器（头部最后一个 .nav-btn 是 + 按钮）
      const navButtons = await driver.findElements(By.css('.nav-btn'));
      await navButtons[navButtons.length - 1].click();
      await waitForVisible(driver, '[data-testid="create-character-manually"]', 10000);
      await driver.findElement(By.css('[data-testid="create-character-manually"]')).click();
      await waitForVisible(driver, '[data-testid="character-editor"]', 10000);

      // 模拟系统返回键
      await driver.navigate().back();

      // 编辑器应关闭，且仍停留在角色管理页
      await driver.wait(async () => !(await editorIsPresent(driver)), 10000, '编辑器未被返回键关闭');

      const url = await driver.getCurrentUrl();
      if (!url.includes('/role-management')) {
        throw new Error(`返回键把用户带离了角色管理页: ${url}`);
      }

      const page = await driver.findElements(By.css('.role-management-page'));
      if (page.length === 0) {
        throw new Error('角色管理页已不在渲染中');
      }
    } finally {
      await driver.quit();
    }
  },

  '编辑器用界面按钮关闭后，返回键不应被多余的占位历史吞掉': async () => {
    const driver = buildDriver();
    try {
      await driver.get(ROLE_URL);
      await waitForVisible(driver, '.role-management-page', 15000);

      // 打开再关闭，检查占位历史记录被正确回收
      const navButtons = await driver.findElements(By.css('.nav-btn'));
      await navButtons[navButtons.length - 1].click();
      await waitForVisible(driver, '[data-testid="create-character-manually"]', 10000);
      await driver.findElement(By.css('[data-testid="create-character-manually"]')).click();
      await waitForVisible(driver, '[data-testid="character-editor"]', 10000);

      const closeButton = await driver.findElement(By.css('.editor-nav-btn'));
      await closeButton.click();
      await driver.wait(async () => !(await editorIsPresent(driver)), 10000, '编辑器未被关闭按钮关闭');

      await driver.sleep(300);

      // 此时按返回应真的离开角色管理页，说明没有残留占位记录
      await driver.navigate().back();

      await driver.wait(async () => {
        const url = await driver.getCurrentUrl();
        return !url.includes('/role-management');
      }, 10000, '返回键被残留的占位历史吞掉了');
    } finally {
      await driver.quit();
    }
  },
};
