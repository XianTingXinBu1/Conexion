/**
 * 构建检查
 */

export async function runBuildCheck() {
  const startTime = Date.now();

  try {
    const { execSync } = await import('child_process');

    // 运行构建命令
    execSync('npm run build', {
      stdio: 'pipe',
      encoding: 'utf-8',
    });

    return {
      name: '项目构建检查',
      status: 'pass',
      duration: Date.now() - startTime,
    };
  } catch (error) {
    const output = error.stderr || error.stdout || error.message || '';

    return {
      name: '项目构建检查',
      status: 'fail',
      duration: Date.now() - startTime,
      message: '构建失败',
      details: output,
    };
  }
}