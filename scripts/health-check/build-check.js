/**
 * 构建检查
 *
 * 注意：Termux 上 npm .bin 的 shebang 指向 /usr/bin/env（不存在），
 * `npm run build` 会报 vue-tsc / vite not found。
 * 因此优先直接调用 node 入口执行类型检查 + 构建。
 */

export async function runBuildCheck() {
  const startTime = Date.now();

  try {
    const { execSync } = await import('child_process');
    const { existsSync } = await import('node:fs');
    const { resolve, dirname } = await import('node:path');
    const { fileURLToPath } = await import('node:url');

    const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
    const vueTscCli = resolve(projectRoot, 'node_modules/vue-tsc/bin/vue-tsc.js');
    const viteCli = resolve(projectRoot, 'node_modules/vite/bin/vite.js');

    const command = (existsSync(vueTscCli) && existsSync(viteCli))
      ? `node "${vueTscCli}" -b && node "${viteCli}" build`
      : 'npm run build';

    execSync(command, {
      stdio: 'pipe',
      encoding: 'utf-8',
      cwd: projectRoot,
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