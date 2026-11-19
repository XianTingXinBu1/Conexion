/**
 * 依赖检查
 *
 * 用 `npm list --json` 读 `problems` 列表，而不是看退出码：
 * npm 7+ 只要存在 peer 依赖告警 / extraneous 多余包 / invalid 版本就返回非 0，
 * 拿退出码当结论会把这类「能正常跑」的情况判成闸门失败。
 * 真正致命的是 missing（缺包）与 invalid（版本不满足）。
 */

/** problems 里形如 "missing: foo@1.0.0, required by bar@1.0.0" */
const FATAL_PROBLEM_PREFIXES = ['missing', 'invalid'];

export async function runDepsCheck() {
  const startTime = Date.now();

  try {
    const { execSync } = await import('child_process');
    const { resolve, dirname } = await import('node:path');
    const { fileURLToPath } = await import('node:url');

    const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

    let rawOutput = '';
    try {
      rawOutput = execSync('npm list --depth=0 --json', {
        stdio: 'pipe',
        encoding: 'utf-8',
        cwd: projectRoot,
        maxBuffer: 16 * 1024 * 1024,
      });
    } catch (error) {
      // 退出码非 0 是常见情况（有告警），stdout 里依然是完整 JSON
      rawOutput = typeof error?.stdout === 'string' ? error.stdout : '';
      if (!rawOutput) {
        throw error;
      }
    }

    let parsed;
    try {
      parsed = JSON.parse(rawOutput);
    } catch {
      return {
        name: '依赖完整性检查',
        status: 'fail',
        duration: Date.now() - startTime,
        message: '依赖检查失败',
        details: `无法解析 npm list 输出：\n${rawOutput.slice(0, 2000)}`,
      };
    }

    const problems = Array.isArray(parsed?.problems) ? parsed.problems.map(String) : [];
    const fatalProblems = problems.filter(problem =>
      FATAL_PROBLEM_PREFIXES.some(prefix => problem.toLowerCase().startsWith(prefix)),
    );

    if (fatalProblems.length > 0) {
      return {
        name: '依赖完整性检查',
        status: 'fail',
        duration: Date.now() - startTime,
        message: `依赖缺失或版本不满足（${fatalProblems.length} 项）`,
        details: fatalProblems.join('\n'),
      };
    }

    return {
      name: '依赖完整性检查',
      status: 'pass',
      duration: Date.now() - startTime,
      // 非致命的告警（peer / extraneous）不拦闸，但留在 details 里方便排查
      ...(problems.length > 0 ? { details: `仅有告警：\n${problems.join('\n')}` } : {}),
    };
  } catch (error) {
    const output = [error?.stdout, error?.stderr, error?.message]
      .filter(part => typeof part === 'string' && part.length > 0)
      .join('\n');

    return {
      name: '依赖完整性检查',
      status: 'fail',
      duration: Date.now() - startTime,
      message: '依赖检查失败',
      details: output,
    };
  }
}
