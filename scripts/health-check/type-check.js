/**
 * TypeScript 类型检查
 *
 * 注意：Termux 上 npm .bin 的 shebang 指向 /usr/bin/env（不存在），
 * 因此优先直接调用 vue-tsc 的 node 入口，避免 `vue-tsc: not found`。
 */

export async function runTypeCheck() {
  const startTime = Date.now();

  try {
    const { execSync } = await import('child_process');
    const { existsSync } = await import('node:fs');
    const { resolve, dirname } = await import('node:path');
    const { fileURLToPath } = await import('node:url');

    const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
    const vueTscCli = resolve(projectRoot, 'node_modules/vue-tsc/bin/vue-tsc.js');

    // Termux 友好：直接用 node 跑 CLI，避开 .bin shebang
    const command = existsSync(vueTscCli)
      ? `node "${vueTscCli}" -b --noEmit`
      : 'npx vue-tsc --noEmit';

    execSync(command, {
      stdio: 'pipe',
      encoding: 'utf-8',
      cwd: projectRoot,
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