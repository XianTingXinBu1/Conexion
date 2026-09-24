# E2E 测试

基于 Selenium + Termux 系统 Chromium 的端到端测试。

## 为什么不用 Playwright / Cypress

Termux (Android/aarch64) 上 Playwright 自带的浏览器二进制无法运行。
本项目复用系统已安装的 `chromium-browser` + `chromedriver`，通过 Selenium 驱动。

## 前置条件

- Termux 已安装：`pkg install chromium`（含 chromedriver）
- 应用服务已启动：前端 `:3100`、后端 `:3900`

## 运行

服务由项目现有脚本管理（与手动开发一致）：

```bash
sh scripts/dev/manage.sh start     # 启动前后端
sh scripts/dev/manage.sh status    # 查看状态
sh scripts/dev/manage.sh stop      # 停止
```

跑 E2E：

```bash
node e2e/run.mjs           # 全部用例
node e2e/run.mjs macro     # 只跑名字含 macro 的用例
npm run e2e                # 等价于 node e2e/run.mjs
```

通过健康检查一起跑（会自动确保服务就绪）：

```bash
npm run health-check              # 含 E2E
npm run health-check:quick        # 跳过测试/构建/E2E
node scripts/health-check/health-check.js --skip-e2e   # 单独跳过 E2E
```

> E2E 较慢，因此在 health-check 中标记为**非关键项**（critical: false），失败不会阻断构建。

## 注意

- Termux 上 npm `.bin` 的脚本 shebang 指向 `/usr/bin/env`（不存在），
  因此 E2E 一律用 `node xxx.mjs` 直接执行，不依赖 `.bin`。
- Chromium 的 dbus / inotify 报错是无害噪音。
- 应用使用 hash 路由，页面地址形如 `http://127.0.0.1:3100/#/prompt-preset`。

## 目录结构

```
e2e/
  helpers/driver.mjs       # 驱动封装（headless、手机视口）
  cases/                   # 用例，每个文件 export default { 用例名: async fn }
  run.mjs                  # 运行器（可 CLI，也可被 health-check 导入）
```

健康检查集成：

```
scripts/health-check/e2e-check.js   # 接入 health-check 框架
scripts/dev/manage.sh               # 前后端启停（复用）
```

## 新增用例

在 `e2e/cases/` 下新建 `.mjs`，导出对象：

```js
import { buildDriver, BASE_URL } from '../helpers/driver.mjs';

export default {
  '用例名': async () => {
    const driver = buildDriver();
    try {
      // ...
    } finally {
      await driver.quit();
    }
  },
};
```

## 现有用例

- `smoke.mjs` — 应用能加载
- `macro.mjs` — 提示词界面的变量 chips 存在且可插入
- `macro-replacement.mjs` — 浏览器运行时下 `{{...}}` 变量被正确替换
