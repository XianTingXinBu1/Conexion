/**
 * E2E 驱动封装（Selenium + 系统 Chromium）
 *
 * 为什么不下载自己的浏览器：直接复用系统 chromium + chromedriver，驱动与浏览器版本天然一致，
 * 同一套用例在 Arch / Debian / Termux 上都能跑（路径解析见 chromedriver-path.mjs）。
 * 注意：
 * - 必须 --no-sandbox（容器 / Android 上没有可用的 setuid sandbox）
 * - dbus / inotify 报错是无害噪音
 * - 用 node 直跑，不依赖 node_modules/.bin（Termux 上的 shebang 指向不存在的 /usr/bin/env）
 */

import { Builder, By, until } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome.js';
import { chromedriverMissingMessage, findChromedriverPath } from './chromedriver-path.mjs';

export { findChromedriverPath };

export const BASE_URL = process.env.E2E_BASE_URL || 'http://127.0.0.1:3100';

// 移动端优先：模拟手机视口
const MOBILE_VIEWPORT = { width: 390, height: 844 };

export { By, until };

export function buildDriver() {
  const chromedriverPath = findChromedriverPath();
  if (!chromedriverPath) {
    throw new Error(chromedriverMissingMessage());
  }

  const options = new chrome.Options();
  options.addArguments(
    '--headless=new',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    `--window-size=${MOBILE_VIEWPORT.width},${MOBILE_VIEWPORT.height}`,
  );

  const service = new chrome.ServiceBuilder(chromedriverPath);

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
