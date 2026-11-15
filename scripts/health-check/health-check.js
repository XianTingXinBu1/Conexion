#!/usr/bin/env node

/**
 * 健康检查主脚本
 * 快速检查项目代码质量
 */

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runBuildCheck } from './build-check.js';
import { runTestCheck } from './test-check.js';
import { runDepsCheck } from './deps-check.js';
import { runArchitectureCheck } from './architecture-check.js';
import { runE2ECheck } from './e2e-check.js';

// 定义所有检查项
//
// 没有独立的 type-check 项：构建检查里的 `vue-tsc -b` 就是类型检查，
// 而 `vue-tsc -b --noEmit` 每次都是全量重查（约 15s，不读增量缓存），
// 单独再跑一遍纯属重复。构建失败时按输出区分「类型错误」与「打包错误」。
const CHECKS = [
  {
    name: 'deps-check',
    description: '依赖完整性检查',
    critical: true,
    run: () => runDepsCheck(),
  },
  {
    name: 'test-check',
    description: '单元测试检查',
    // 关键项：单测与覆盖率门槛都属提交前的硬闸，挂掉应当阻断而非仅告警。
    critical: true,
    run: (opts) => runTestCheck(opts),
  },
  {
    name: 'architecture-check',
    description: '架构边界检查',
    critical: true,
    run: () => runArchitectureCheck(),
  },
  {
    name: 'e2e-check',
    description: 'E2E 浏览器测试',
    // 非关键项：依赖系统 Chromium 与版本匹配的 chromedriver，环境不对时只告警
    critical: false,
    // 默认跳过，由 --e2e 显式启用：它是一半的耗时，而覆盖面（DOM 级 XSS、
    // 拖拽几何、返回键）只在改渲染 / 路由 / 交互时才可能受影响
    optional: true,
    run: (opts) => runE2ECheck(opts),
  },
  {
    name: 'build-check',
    description: '项目构建检查',
    critical: true,
    run: (opts) => runBuildCheck(opts),
  },
];

/**
 * 打印检查结果
 */
function printResult(result, verbose = false) {
  const statusSymbol = {
    pass: '✓',
    fail: '✗',
    skip: '○',
  };

  const statusColor = {
    pass: '\x1b[32m', // 绿色
    fail: '\x1b[31m', // 红色
    skip: '\x1b[33m', // 黄色
  };

  const resetColor = '\x1b[0m';

  const symbol = statusSymbol[result.status];
  const color = statusColor[result.status];

  console.log(`  ${color}${symbol}${resetColor} ${result.name} (${result.duration}ms)`);

  if (result.message && result.status !== 'pass') {
    console.log(`    ${result.message}`);
  }

  if (verbose && result.details) {
    console.log(`\n    详细信息:`);
    const lines = result.details.split('\n');
    lines.forEach(line => {
      console.log(`    ${line}`);
    });
    console.log('');
  }
}

/**
 * 打印摘要
 */
function printSummary(report) {
  const { summary, criticalFailures } = report;

  console.log('\n' + '='.repeat(50));
  console.log('检查摘要:');
  console.log('='.repeat(50));
  console.log(`  总计:   ${summary.total}`);
  console.log(`  \x1b[32m✓ 通过:  ${summary.passed}\x1b[0m`);
  console.log(`  \x1b[31m✗ 失败:  ${summary.failed}\x1b[0m`);
  console.log(`  \x1b[33m○ 跳过:  ${summary.skipped}\x1b[0m`);
  console.log(`  耗时:   ${report.totalDuration}ms`);
  console.log('='.repeat(50));

  if (criticalFailures.length > 0) {
    console.log('\x1b[31m关键检查失败:\x1b[0m');
    criticalFailures.forEach(failure => {
      console.log(`  - ${failure}`);
    });
    console.log('\x1b[31m关键检查失败，请修复后再提交代码！\x1b[0m');
  } else if (summary.failed > 0) {
    console.log('\x1b[33m部分检查失败，建议修复后再提交代码。\x1b[0m');
  } else {
    console.log('\x1b[32m✓ 所有检查通过！\x1b[0m');
  }
}

/**
 * 运行健康检查
 *
 * 串行执行，刻意不做并行：这台机器（i5-2430M / 2 核）实测并行是负收益——
 * 三路同时跑时 test 34s→61s、E2E 42s→105s，总耗时几乎不变；
 * 只并行「E2E + 构建」时 E2E 也会从 42s 拖到 68s。CPU 争抢吃掉了全部收益，
 * 还让耗时变得不可预测。真正有效的削时手段是：不重复跑类型检查（build 已含）
 * 与默认跳过 E2E（--e2e 启用）。
 */
export async function runHealthCheck(options = {}) {
  const startTime = Date.now();
  const results = [];

  console.log('\x1b[36m' + '='.repeat(50) + '\x1b[0m');
  console.log('\x1b[36m🔍 开始健康检查...\x1b[0m');
  console.log('\x1b[36m' + '='.repeat(50) + '\x1b[0m\n');

  for (const check of CHECKS) {
    console.log(`\x1b[90m检查: ${check.description}...\x1b[0m`);

    // 单个检查抛异常不能让整轮检查中断，也不能让 results 与 CHECKS 下标错位
    let result;
    const checkStart = Date.now();
    try {
      result = await check.run(options);
    } catch (error) {
      result = {
        name: check.name,
        status: 'fail',
        duration: Date.now() - checkStart,
        message: `检查抛出异常：${error instanceof Error ? error.message : String(error)}`,
        details: error instanceof Error ? error.stack : undefined,
      };
    }
    results.push(result);

    printResult(result, options.verbose || false);
  }

  const endTime = Date.now();

  const summary = {
    total: results.length,
    passed: results.filter(r => r.status === 'pass').length,
    failed: results.filter(r => r.status === 'fail').length,
    skipped: results.filter(r => r.status === 'skip').length,
  };

  const criticalFailures = results
    .filter((result, index) => result.status === 'fail' && CHECKS[index]?.critical)
    .map(result => result.name);

  const report = {
    startTime,
    endTime,
    totalDuration: endTime - startTime,
    results,
    summary,
    criticalFailures,
  };

  printSummary(report);

  return report;
}

/**
 * CLI 入口
 */
async function main() {
  const args = process.argv.slice(2);
  const options = {
    skipTests: args.includes('--skip-tests'),
    skipBuild: args.includes('--skip-build'),
    // E2E 默认跳过：它占掉一半耗时，而覆盖面只在改渲染 / 路由 / 交互时才相关。
    // 需要时用 --e2e 显式启用（npm run health-check:full）。
    skipE2E: args.includes('--skip-e2e') || !args.includes('--e2e'),
    verbose: args.includes('--verbose') || args.includes('-v'),
  };

  const report = await runHealthCheck(options);

  // 如果有关键检查失败，返回非零退出码
  if (report.criticalFailures.length > 0) {
    process.exit(1);
  }

  process.exit(0);
}

// 仅在被直接执行时才跑：被 import（单测 / 复用 runHealthCheck）时不该触发整轮检查与 process.exit
const isCli = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  main().catch(error => {
    console.error('\x1b[31m健康检查执行失败:\x1b[0m', error);
    process.exit(1);
  });
}

export { CHECKS };
