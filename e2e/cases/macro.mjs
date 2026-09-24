/**
 * 宏（变量）功能 E2E
 *
 * 验证：提示词编辑界面提供变量 chips，点击后能插入到提示词中。
 * 覆盖新建条目弹窗（PromptFormModal）路径。
 */

import { buildDriver, BASE_URL, By, waitForVisible } from '../helpers/driver.mjs';

const PROMPT_URL = `${BASE_URL}/#/prompt-preset`;

async function openPromptPage(driver) {
  await driver.get(PROMPT_URL);
  await waitForVisible(driver, '.prompt-preset-page', 15000);
}

async function findChipByText(scope, token) {
  const chips = await scope.findElements(By.css('.macro-chip'));
  for (const chip of chips) {
    const text = await chip.getText();
    if (text.includes(token)) return chip;
  }
  return null;
}

export default {
  '新建条目弹窗展示变量 chips 并能插入 {{char}}': async () => {
    const driver = buildDriver();
    try {
      await openPromptPage(driver);

      // 头部右侧“+”按钮打开新建表单（最后一个 .nav-btn）
      const navButtons = await driver.findElements(By.css('.nav-btn'));
      await navButtons[navButtons.length - 1].click();

      const modal = await waitForVisible(driver, '.modal-overlay', 10000);

      const chipCount = (await modal.findElements(By.css('.macro-chip'))).length;
      if (chipCount < 6) {
        throw new Error(`变量 chip 数量不足: ${chipCount}`);
      }

      // 填写名称与描述（保存必填）
      const nameInput = await modal.findElement(By.css('.form-input'));
      await nameInput.sendKeys('E2E 宏测试条目');

      const textareas = await modal.findElements(By.css('.form-textarea'));
      if (textareas.length < 2) {
        throw new Error(`未找到描述/提示词输入框，textareas=${textareas.length}`);
      }
      await textareas[0].sendKeys('E2E 描述');

      // 点击 {{char}} chip
      const charChip = await findChipByText(modal, '{{char}}');
      if (!charChip) throw new Error('未找到 {{char}} 变量 chip');
      await charChip.click();

      // 提示词输入框（第二个 textarea）应包含 {{char}}
      const promptValue = await textareas[1].getAttribute('value');
      if (!promptValue || !promptValue.includes('{{char}}')) {
        throw new Error(`提示词未插入变量，当前值: "${promptValue}"`);
      }
    } finally {
      await driver.quit();
    }
  },

  '变量 chips 覆盖全部约定的变量名': async () => {
    const driver = buildDriver();
    try {
      await openPromptPage(driver);

      const navButtons = await driver.findElements(By.css('.nav-btn'));
      await navButtons[navButtons.length - 1].click();

      const modal = await waitForVisible(driver, '.modal-overlay', 10000);
      const chips = await modal.findElements(By.css('.macro-chip'));

      const tokens = [];
      for (const chip of chips) {
        tokens.push((await chip.getText()).trim());
      }

      const expected = [
        '{{char}}', '{{user}}', '{{description}}',
        '{{personality}}', '{{user_description}}',
        '{{time}}', '{{date}}', '{{weekday}}', '{{hour}}',
      ];

      for (const token of expected) {
        if (!tokens.includes(token)) {
          throw new Error(`缺少变量 chip: ${token}，实际: ${tokens.join(', ')}`);
        }
      }
    } finally {
      await driver.quit();
    }
  },
};
