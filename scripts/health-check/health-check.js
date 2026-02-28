#!/usr/bin/env node

/**
 * 健康检查主脚本
 * 快速检查项目代码质量
 */

import { runTypeCheck } from './type-check.js';
import { runBuildCheck } from './build-check.js';
import { runTestCheck } from './test-check.js';
import { runDepsCheck } from './deps-check.js';

// 定义所有检查项
const CHECKS = [
  {
    name: 'type-check',
    description: 'TypeScript 类型检查',
    critical: true,
    run: () => runTypeCheck(),
  },
  {
    name: 'deps-check',
    description: '依赖完整性检查',
    critical: true,
    run: () => runDepsCheck(),
  },
  {
    name: 'test-check',
    description: '单元测试检查',
    critical: false,
    run: (opts) => runTestCheck(opts),
  },
  {
    name: 'build-check',
    description: '项目构建检查',
    critical: true,
    run: () => runBuildCheck(),
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
 */
export async function runHealthCheck(options = {}) {
  const startTime = Date.now();
  const results = [];

  console.log('\x1b[36m' + '='.repeat(50) + '\x1b[0m');
  console.log('\x1b[36m🔍 开始健康检查...\x1b[0m');
  console.log('\x1b[36m' + '='.repeat(50) + '\x1b[0m\n');

  for (const check of CHECKS) {
    console.log(`\x1b[90m检查: ${check.description}...\x1b[0m`);

    const result = await check.run(options);
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
    .filter((r, i) => r.status === 'fail' && CHECKS[i].critical)
    .map(r => r.name);

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
    verbose: args.includes('--verbose') || args.includes('-v'),
  };

  const report = await runHealthCheck(options);

  // 如果有关键检查失败，返回非零退出码
  if (report.criticalFailures.length > 0) {
    process.exit(1);
  }

  process.exit(0);
}

// 直接运行 main 函数
main().catch(error => {
  console.error('\x1b[31m健康检查执行失败:\x1b[0m', error);
  process.exit(1);
});

export { CHECKS };
