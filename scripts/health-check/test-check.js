/**
 * 测试检查
 *
 * 带 --coverage 执行：覆盖率门槛（vitest.config.ts 的 coverage.thresholds）只在
 * --coverage 模式下校验，不带它等于没有闸。代价是比裸跑多约 4s。
 */

export async function runTestCheck(options = {}) {
  const startTime = Date.now();

  // 如果跳过测试，返回 skip 状态
  if (options.skipTests) {
    return {
      name: '单元测试检查',
      status: 'skip',
      duration: 0,
      message: '已跳过测试',
    };
  }

  try {
    const { execSync } = await import('child_process');
    const { existsSync } = await import('node:fs');
    const { resolve, dirname } = await import('node:path');
    const { fileURLToPath } = await import('node:url');

    const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
    const vitestCli = resolve(projectRoot, 'node_modules/vitest/vitest.mjs');

    // Termux 友好：直接用 node 跑 vitest 入口，避开 .bin shebang
    // 只输出 text reporter：健康检查只需要控制台结果，html / json / lcov
    // 文件生成在提交前快检里是纯开销（`npm run test:coverage` 仍产全量报告）。
    const command = existsSync(vitestCli)
      ? `node "${vitestCli}" run --coverage --coverage.reporter=text`
      : 'npx vitest run --coverage --coverage.reporter=text';

    execSync(command, {
      stdio: 'pipe',
      encoding: 'utf-8',
      cwd: projectRoot,
      // 默认 maxBuffer 只有 1MB：--coverage.reporter=text 会输出全部文件的明细，
      // 文件多时很容易超限抛 ENOBUFS，然后被归类成「测试失败」的假失败
      maxBuffer: 32 * 1024 * 1024,
      // 用例里有未结束的 timer / 子进程时 vitest 不会自己退出，
      // 没有超时会让健康检查永久阻塞
      timeout: 10 * 60 * 1000,
    });

    return {
      name: '单元测试检查',
      status: 'pass',
      duration: Date.now() - startTime,
    };
  } catch (error) {
    const output = [error?.stdout, error?.stderr, error?.message]
      .filter(part => typeof part === 'string' && part.length > 0)
      .join('\n');

    // 检查是否是因为没有测试文件
    if (output.includes('No test files found')) {
      return {
        name: '单元测试检查',
        status: 'skip',
        duration: Date.now() - startTime,
        message: '未找到测试文件',
      };
    }

    return {
      name: '单元测试检查',
      status: 'fail',
      duration: Date.now() - startTime,
      message: output.includes('ERROR: Coverage')
        ? '测试通过但覆盖率未达门槛'
        : '测试失败',
      details: output,
    };
  }
}