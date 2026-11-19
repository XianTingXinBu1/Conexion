import { ApiTimeoutError } from './errors';

/**
 * 本地后端请求的默认超时。
 *
 * 后端与前端同机，超过这个时间基本可以判定为异常（挂住、数据损坏等）。
 * 没有超时意味着界面会永久等待，所以本地数据请求也需要这层保护。
 */
export const LOCAL_REQUEST_TIMEOUT_MS = 15000;

export interface AbortControllerHandle {
  controller: AbortController;
  cleanup: () => void;
}

/**
 * 创建「超时即中止」的 AbortController。
 *
 * 以 ApiTimeoutError 作为 abort reason：fetch 会原样 reject 该错误
 * （已对真实 fetch 验证），因此调用方可以精确区分：
 * - 超时：error instanceof ApiTimeoutError
 * - 用户主动取消：error.name === 'AbortError'
 *
 * 传入 externalSignal 时两个 signal 会合并：外部取消或超时都会 abort。
 * 以前调用方用 `options.signal ?? controller.signal` 二选一，只要传了自己的
 * signal，超时 controller 就被整体丢弃，超时保护静默失效。
 *
 * 调用方必须在请求结束时调用 cleanup()，否则会残留定时器与 abort 监听。
 */
export function createTimeoutController(
  timeoutMs: number,
  externalSignal?: AbortSignal | null,
): AbortControllerHandle {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort(new ApiTimeoutError());
  }, timeoutMs);

  let detachExternal = () => {};

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort(externalSignal.reason);
    } else {
      const onExternalAbort = () => controller.abort(externalSignal.reason);
      externalSignal.addEventListener('abort', onExternalAbort, { once: true });
      detachExternal = () => externalSignal.removeEventListener('abort', onExternalAbort);
    }
  }

  return {
    controller,
    cleanup: () => {
      clearTimeout(timeoutId);
      detachExternal();
    },
  };
}
