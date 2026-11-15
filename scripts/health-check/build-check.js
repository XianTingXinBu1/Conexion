/**
 * 构建检查（兼类型检查）
 *
 * 命令是 `vue-tsc -b && vite build`，所以它本身就是类型检查 + 打包两件事。
 * 以前 health-check 里另有一项 type-check 跑 `vue-tsc -b --noEmit`，但后者
 * 每次都是全量重查（约 15s，不读增量缓存），与这里的 `vue-tsc -b` 完全重复。
 * 现已合并到本项，失败时按输出区分「类型错误」与「打包错误」。
 *
 * 注意：Termux 上 npm .bin 的 shebang 指向 /usr/bin/env（不存在），
 * `npm run build` 会报 vue-tsc / vite not found。
 * 因此优先直接调用 node 入口执行类型检查 + 构建。
 */

export async function runBuildCheck(options = {}) {
  const startTime = Date.now();

  // 如果跳过构建，返回 skip 状态
  if (options.skipBuild) {
    return {
      name: '项目构建检查',
      status: 'skip',
      duration: 0,
      message: '已跳过构建',
    };
  }

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
      message: output.includes('error TS') ? '存在类型错误' : '构建失败',
      details: output,
    };
  }
}