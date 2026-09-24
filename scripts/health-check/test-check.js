/**
 * 测试检查
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
    const command = existsSync(vitestCli)
      ? `node "${vitestCli}" run`
      : 'npx vitest run';

    execSync(command, {
      stdio: 'pipe',
      encoding: 'utf-8',
      cwd: projectRoot,
    });

    return {
      name: '单元测试检查',
      status: 'pass',
      duration: Date.now() - startTime,
    };
  } catch (error) {
    const output = error.stderr || error.stdout || error.message || '';

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
      message: '测试失败',
      details: output,
    };
  }
}