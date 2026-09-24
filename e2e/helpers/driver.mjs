/**
 * E2E 驱动封装（Selenium + Termux 系统 Chromium）
 *
 * Termux 上 Playwright 的浏览器二进制不可用，因此复用系统 chromedriver。
 * 注意：
 * - 必须 --no-sandbox（Android 上无法用 setuid sandbox）
 * - dbus / inotify 报错是无害噪音
 * - npm .bin 的 shebang 指向 /usr/bin/env，Termux 不存在，需用 node 直跑
 */

import { Builder, By, until } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome.js';

const CHROMEDRIVER_PATH = process.env.CHROMEDRIVER_PATH
  || '/data/data/com.termux/files/usr/bin/chromedriver';

export const BASE_URL = process.env.E2E_BASE_URL || 'http://127.0.0.1:3100';

// 移动端优先：模拟手机视口
const MOBILE_VIEWPORT = { width: 390, height: 844 };

export { By, until };

export function buildDriver() {
  const options = new chrome.Options();
  options.addArguments(
    '--headless=new',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    `--window-size=${MOBILE_VIEWPORT.width},${MOBILE_VIEWPORT.height}`,
  );

  const service = new chrome.ServiceBuilder(CHROMEDRIVER_PATH);

  return new Builder()
    .forBrowser('chrome')
    .setChromeOptions(options)
    .setChromeService(service)
    .build();
}

/**
 * 轮询等待一个元素出现并返回
 */
export function waitForElement(driver, selector, timeoutMs = 10000) {
  return driver.wait(until.elementLocated(By.css(selector)), timeoutMs);
}

/**
 * 等待元素可见（不只是存在于 DOM）
 */
export async function waitForVisible(driver, selector, timeoutMs = 10000) {
  const el = await waitForElement(driver, selector, timeoutMs);
  await driver.wait(until.elementIsVisible(el), timeoutMs);
  return el;
}

/**
 * 等待文本出现在某元素内
 */
export function waitForText(driver, selector, expected, timeoutMs = 10000) {
  return driver.wait(async () => {
    try {
      const el = await driver.findElement(By.css(selector));
      const text = await el.getText();
      return text.includes(expected);
    } catch {
      return false;
    }
  }, timeoutMs, `等待 ${selector} 包含文本: ${expected}`);
}
