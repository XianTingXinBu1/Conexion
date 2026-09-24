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

  for (const file of files) {
    const modUrl = pathToFileURL(resolve(CASES_DIR, file)).href;
    const mod = await import(modUrl);
    const tests = mod.default ?? {};

    for (const [name, fn] of Object.entries(tests)) {
      const label = `${file} :: ${name}`;
      try {
        await fn();
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
