/**
 * E2E 运行器
 *
 * 不依赖测试框架（规避 Termux 上 npm .bin 的 shebang 问题）。
 * 既可作为 CLI 使用，也可被 scripts/health-check 调用。
 *
 * 用法：
 *   node e2e/run.mjs            # 跑全部
 *   node e2e/run.mjs macro      # 只跑名字包含 macro 的用例
 *
 * 服务依赖：复用 scripts/dev/manage.sh 管理的前后端（:3100 / :3900）。
 */

import { readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CASES_DIR = resolve(__dirname, 'cases');

/** 单个用例的兜底超时：用例挂死时不能让整个运行器停住 */
const DEFAULT_CASE_TIMEOUT_MS = 120_000;

function runWithTimeout(fn, ms) {
  return new Promise((resolvePromise, rejectPromise) => {
    const timer = setTimeout(() => rejectPromise(new Error(`用例超时（${ms}ms）`)), ms);
    Promise.resolve()
      .then(fn)
      .then(
        value => {
          clearTimeout(timer);
          resolvePromise(value);
        },
        error => {
          clearTimeout(timer);
          rejectPromise(error);
        },
      );
  });
}

function listCaseFiles(dir) {
  try {
    return readdirSync(dir).filter(f => f.endsWith('.mjs')).sort();
  } catch {
    return [];
  }
}

/**
 * 运行 E2E 用例
 * @param {{ filter?: string, log?: (msg: string) => void }} options
 * @returns {Promise<{ total: number, passed: number, failed: number, failures: Array<{name:string,message:string}> }>}
 */
export async function runE2E(options = {}) {
  const log = options.log ?? ((msg) => console.log(msg));
  const filter = options.filter;

  const files = listCaseFiles(CASES_DIR).filter(f => (filter ? f.includes(filter) : true));

  let passed = 0;
  let failed = 0;
  const failures = [];

  if (files.length === 0) {
    // 目录为空 / 无读权限 / filter 没匹配到：以失败收场，
    // 否则 health-check 会看到「0 passed, 0 failed」并当成通过。
    const message = `未找到任何 E2E 用例文件（${CASES_DIR}）`;
    log(`\x1b[31m✗\x1b[0m ${message}`);
    return { total: 0, passed: 0, failed: 1, failures: [{ name: 'E2E 用例发现', message }], fileCount: 0 };
  }

  for (const file of files) {
    const modUrl = pathToFileURL(resolve(CASES_DIR, file)).href;

    let mod;
    try {
      mod = await import(modUrl);
    } catch (err) {
      // 单个用例文件加载失败（语法错误 / 依赖缺失 / 顶层抛错）不该让其余用例都不跑
      const message = err?.message ?? String(err);
      const label = `${file} :: 加载用例文件`;
      log(`\x1b[31m✗\x1b[0m ${label}`);
      log(`  ${message}`);
      failures.push({ name: label, message });
      failed++;
      continue;
    }

    const tests = mod.default ?? {};

    for (const [name, fn] of Object.entries(tests)) {
      const label = `${file} :: ${name}`;
      try {
        await runWithTimeout(fn, options.caseTimeoutMs ?? DEFAULT_CASE_TIMEOUT_MS);
        log(`\x1b[32m✓\x1b[0m ${label}`);
        passed++;
      } catch (err) {
        const message = err?.message ?? String(err);
        log(`\x1b[31m✗\x1b[0m ${label}`);
        log(`  ${message}`);
        failures.push({ name: label, message });
        failed++;
      }
    }
  }

  log(`\nE2E: ${passed} passed, ${failed} failed (${files.length} files)`);

  return { total: passed + failed, passed, failed, failures, fileCount: files.length };
}

// CLI 入口
const isCli = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isCli) {
  const result = await runE2E({ filter: process.argv[2] });
  process.exit(result.failed > 0 ? 1 : 0);
}
