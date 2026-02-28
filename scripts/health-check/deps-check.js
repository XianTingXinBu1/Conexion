/**
 * 依赖检查
 */

export async function runDepsCheck() {
  const startTime = Date.now();

  try {
    const { execSync } = await import('child_process');

    // 检查依赖是否存在
    execSync('npm list --depth=0', {
      stdio: 'pipe',
      encoding: 'utf-8',
    });

    return {
      name: '依赖完整性检查',
      status: 'pass',
      duration: Date.now() - startTime,
    };
  } catch (error) {
    const output = error.stderr || error.stdout || error.message || '';

    return {
      name: '依赖完整性检查',
      status: 'fail',
      duration: Date.now() - startTime,
      message: '依赖检查失败',
      details: output,
    };
  }
}