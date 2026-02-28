/**
 * TypeScript 类型检查
 */

export async function runTypeCheck() {
  const startTime = Date.now();

  try {
    const { execSync } = await import('child_process');

    // 运行 TypeScript 类型检查
    execSync('npx vue-tsc --noEmit', {
      stdio: 'pipe',
      encoding: 'utf-8',
    });

    return {
      name: 'TypeScript 类型检查',
      status: 'pass',
      duration: Date.now() - startTime,
    };
  } catch (error) {
    const output = error.stderr || error.stdout || error.message || '';

    return {
      name: 'TypeScript 类型检查',
      status: 'fail',
      duration: Date.now() - startTime,
      message: '存在类型错误',
      details: output,
    };
  }
}