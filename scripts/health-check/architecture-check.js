/**
 * 架构边界检查
 */

export async function runArchitectureCheck() {
  const startTime = Date.now();

  try {
    const { execSync } = await import('child_process');

    execSync('npm run check:architecture', {
      stdio: 'pipe',
      encoding: 'utf-8',
    });

    return {
      name: '架构边界检查',
      status: 'pass',
      duration: Date.now() - startTime,
    };
  } catch (error) {
    const output = error.stderr || error.stdout || error.message || '';

    return {
      name: '架构边界检查',
      status: 'fail',
      duration: Date.now() - startTime,
      message: '架构边界检查失败',
      details: output,
    };
  }
}
