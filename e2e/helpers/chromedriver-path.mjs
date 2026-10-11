/**
 * chromedriver 路径解析。
 *
 * 单独成文件（不 import selenium）：health-check 需要在加载 selenium 之前
 * 判断驱动是否可用，驱动不可用时应「跳过 E2E」而不是让整条检查报错。
 *
 * Termux 把 chromium 装在 `$PREFIX/bin`，Debian / Ubuntu 由 `chromium-driver`
 * 包装在 `/usr/bin`。两条路径都试，别把 E2E 绑死在某个发行版上；
 * `CHROMEDRIVER_PATH` 环境变量始终优先。
 */
import { existsSync } from 'node:fs';

export const CHROMEDRIVER_CANDIDATES = [
  '/data/data/com.termux/files/usr/bin/chromedriver',
  '/usr/bin/chromedriver',
  '/usr/local/bin/chromedriver',
];

/** 返回可用的 chromedriver 路径；都找不到时返回 null，由调用方决定报错还是跳过。 */
export function findChromedriverPath() {
  if (process.env.CHROMEDRIVER_PATH) {
    return process.env.CHROMEDRIVER_PATH;
  }

  return CHROMEDRIVER_CANDIDATES.find(candidate => existsSync(candidate)) ?? null;
}

/** 找不到驱动时的提示文案（安装方式按平台给出）。 */
export function chromedriverMissingMessage() {
  return `未找到 chromedriver，已尝试: ${CHROMEDRIVER_CANDIDATES.join(', ')}`
    + '（Termux: pkg install chromium；Debian/Ubuntu: apt-get install chromium chromium-driver）'
    + '，也可用 CHROMEDRIVER_PATH 指定路径';
}
