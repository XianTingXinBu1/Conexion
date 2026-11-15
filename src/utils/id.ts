/**
 * 唯一 ID 生成
 *
 * 用 `Date.now()` 当 ID 在同一毫秒内会重复：双击保存、批量导入、
 * 脚本/测试快速连续创建都会撞，撞了之后按 id 查找/更新会命中错对象，
 * `v-for` 的 key 也会冲突。所有新建实体的 id 都从这里取。
 */

let fallbackSeq = 0;

export function createId(): string {
  const cryptoObj = globalThis.crypto;
  if (typeof cryptoObj?.randomUUID === 'function') {
    return cryptoObj.randomUUID();
  }

  // 没有 crypto.randomUUID 的环境（老 WebView / 非安全上下文）：
  // 时间戳 + 递增序号 + 随机后缀，保证同一毫秒内也不会重复
  fallbackSeq = (fallbackSeq + 1) % 0xffffff;
  return `${Date.now().toString(36)}-${fallbackSeq.toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}
