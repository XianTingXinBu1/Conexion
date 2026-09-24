/**
 * E2E 浏览器测试检查
 *
 * 依赖：
 * - Termux 系统 Chromium / ChromeDriver
 * - 前端 :3100 与后端 :3900（会尝试通过 scripts/dev/manage.sh 自动启动）
 *
 * 注意：E2E 默认较慢，health-check 中可通过 --skip-e2e 跳过。
 */

const FRONTEND_URL = 'http://127.0.0.1:3100';

/**
 * 检查服务是否已就绪
 */
async function isFrontendReady() {
  try {
    const res = await fetch(FRONTEND_URL, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * 尝试通过项目脚本启动前后端服务
 */
async function ensureServers() {
  const { execSync } = await import('node:child_process');
  const { resolve, dirname } = await import('node:path');
  const { fileURLToPath } = await import('node:url');

  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const projectRoot = resolve(scriptDir, '..', '..');
  const manageScript = resolve(projectRoot, 'scripts', 'dev', 'manage.sh');

  try {
    execSync(`sh "${manageScript}" start`, {
      cwd: projectRoot,
      stdio: 'pipe',
      encoding: 'utf-8',
    });
  } catch (error) {
    // 端口已占用等情况 manage.sh 会报错，但服务可能本来就在跑
    const output = `${error.stdout ?? ''}${error.stderr ?? ''}`;
    if (!output.includes('already')) {
      throw error;
    }
  }
}

export async function runE2ECheck(options = {}) {
  const startTime = Date.now();

  if (options.skipE2E) {
    return {
      name: 'E2E 浏览器测试',
      status: 'skip',
      duration: 0,
      message: '已跳过 E2E',
    };
  }

  // 检查浏览器驱动是否可用
  const { existsSync } = await import('node:fs');
  const chromedriverPath = process.env.CHROMEDRIVER_PATH
    || '/data/data/com.termux/files/usr/bin/chromedriver';
  if (!existsSync(chromedriverPath)) {
    return {
      name: 'E2E 浏览器测试',
      status: 'skip',
      duration: Date.now() - startTime,
      message: `未找到 chromedriver: ${chromedriverPath}`,
    };
  }

  try {
    // 确保服务就绪
    if (!(await isFrontendReady())) {
      await ensureServers();
    }

    if (!(await isFrontendReady())) {
      return {
        name: 'E2E 浏览器测试',
        status: 'fail',
        duration: Date.now() - startTime,
        message: `前端服务未就绪: ${FRONTEND_URL}`,
      };
    }

    const { runE2E } = await import('../../e2e/run.mjs');
    const result = await runE2E({ log: () => {} });

    if (result.failed > 0) {
      return {
        name: 'E2E 浏览器测试',
        status: 'fail',
        duration: Date.now() - startTime,
        message: `${result.failed}/${result.total} 个 E2E 用例失败`,
        details: result.failures.map(f => `- ${f.name}\n  ${f.message}`).join('\n'),
      };
    }

    return {
      name: 'E2E 浏览器测试',
      status: 'pass',
      duration: Date.now() - startTime,
      message: `${result.passed} 个用例通过`,
    };
  } catch (error) {
    const output = error.stderr || error.stdout || error.message || String(error);
    return {
      name: 'E2E 浏览器测试',
      status: 'fail',
      duration: Date.now() - startTime,
      message: 'E2E 执行失败',
      details: output,
    };
  }
}
