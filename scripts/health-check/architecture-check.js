/**
 * 架构边界检查
 */

export async function runArchitectureCheck() {
  const startTime = Date.now();

  try {
    const { execSync } = await import('child_process');
    const { resolve, dirname } = await import('node:path');
    const { fileURLToPath } = await import('node:url');

    // 与 build-check / test-check 保持一致：显式以项目根为 cwd。
    // 以前不传 cwd，从子目录（或用绝对路径）调用时找不到 package.json，
    // 会被误报成「架构边界检查失败」。
    const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

    execSync('npm run check:architecture', {
      stdio: 'pipe',
      encoding: 'utf-8',
      cwd: projectRoot,
      maxBuffer: 16 * 1024 * 1024,
    });

    return {
      name: '架构边界检查',
      status: 'pass',
      duration: Date.now() - startTime,
    };
  } catch (error) {
    const output = [error?.stdout, error?.stderr, error?.message]
      .filter(part => typeof part === 'string' && part.length > 0)
      .join('\n');

    return {
      name: '架构边界检查',
      status: 'fail',
      duration: Date.now() - startTime,
      message: '架构边界检查失败',
      details: output,
    };
  }
}
