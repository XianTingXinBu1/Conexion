import { UpstreamRequestError, isUpstreamRequestError, mapUpstreamError } from '../errors';

export interface UpstreamRequestOptions {
  method: 'GET' | 'POST' | 'HEAD';
  upstreamUrl: string;
  apiKey?: string;
  body?: string;
  timeoutMs: number;
}

export interface UpstreamResponsePayload {
  status: number;
  body?: string;
  headers: Headers;
  stream?: ReadableStream<Uint8Array> | null;
}

interface TimeoutControllerHandle {
  controller: AbortController;
  cleanup: () => void;
  refresh: () => void;
}

/**
 * 重试策略。
 *
 * 重试放在后端，而不是前端：只有这里知道请求是否幂等。
 * - GET / HEAD 会重试：重发不产生副作用。
 * - POST 不重试：上游可能已经开始生成内容，重发会造成重复计费与重复生成。
 * - 超时不重试：重试只会让总等待时间翻倍，而且上游可能仍在处理。
 * - 流式响应不重试：响应头一旦返回，连接已经交给调用方消费。
 */
const RETRY_ATTEMPTS = 2;
const RETRY_BASE_DELAY_MS = 150;
/** 单次重试最多等 5s：上游给的 Retry-After 可能很大，不能让它把请求拖死 */
const RETRY_MAX_DELAY_MS = 5000;
/** 只重试「确定是瞬时故障」的状态码 */
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

function isIdempotentMethod(method: UpstreamRequestOptions['method']): boolean {
  return method === 'GET' || method === 'HEAD';
}

function isRetryableError(error: unknown): boolean {
  // 504 由 createTimeoutController 作为 abort reason 抛出，代表超时
  if (isUpstreamRequestError(error) && error.statusCode === 504) {
    return false;
  }

  return true;
}

/** 解析 Retry-After：既支持秒数，也支持 HTTP-date（RFC 7231） */
function parseRetryAfterMs(headers: Headers): number | undefined {
  const raw = headers.get('retry-after');
  if (!raw) {
    return undefined;
  }

  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(seconds * 1000, RETRY_MAX_DELAY_MS);
  }

  const dateMs = Date.parse(raw);
  if (Number.isFinite(dateMs)) {
    return Math.min(Math.max(dateMs - Date.now(), 0), RETRY_MAX_DELAY_MS);
  }

  return undefined;
}

/**
 * 重试等待：上游给了 Retry-After 就听它的，否则指数退避 + 抖动。
 * 抖动是为了避免多个并发请求在同一时刻一起重试，把上游又打一次尖峰。
 */
function resolveRetryDelayMs(attempt: number, headers?: Headers): number {
  const retryAfterMs = headers ? parseRetryAfterMs(headers) : undefined;
  if (retryAfterMs !== undefined) {
    return retryAfterMs;
  }

  const backoff = RETRY_BASE_DELAY_MS * 2 ** (attempt - 1);
  return Math.min(backoff + Math.random() * RETRY_BASE_DELAY_MS, RETRY_MAX_DELAY_MS);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, ms).unref?.();
  });
}

function createTimeoutController(timeoutMs: number): TimeoutControllerHandle {
  const controller = new AbortController();
  let timeoutId: NodeJS.Timeout | undefined;

  const cleanup = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = undefined;
    }
  };

  const refresh = () => {
    cleanup();
    timeoutId = setTimeout(() => {
      controller.abort(new UpstreamRequestError(504, '上游请求超时'));
    }, timeoutMs);
    timeoutId.unref?.();
  };

  controller.signal.addEventListener('abort', cleanup, { once: true });
  refresh();

  return { controller, cleanup, refresh };
}

function wrapStreamWithCleanup(
  stream: ReadableStream<Uint8Array> | null,
  timeout: Pick<TimeoutControllerHandle, 'cleanup' | 'refresh'>,
  abort: (reason?: unknown) => void,
): ReadableStream<Uint8Array> | null {
  if (!stream) {
    timeout.cleanup();
    return null;
  }

  const reader = stream.getReader();

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          timeout.cleanup();
          controller.close();
          return;
        }

        timeout.refresh();
        controller.enqueue(value);
      } catch (error) {
        timeout.cleanup();
        controller.error(error);
      }
    },
    async cancel(reason) {
      timeout.cleanup();
      abort(reason);
      await reader.cancel(reason);
    },
  });
}

export async function proxyUpstreamRequest(
  options: UpstreamRequestOptions & { stream?: false },
): Promise<UpstreamResponsePayload>;
export async function proxyUpstreamRequest(
  options: UpstreamRequestOptions & { stream: true },
): Promise<UpstreamResponsePayload>;
export async function proxyUpstreamRequest(
  options: UpstreamRequestOptions & { stream?: boolean },
): Promise<UpstreamResponsePayload> {
  const maxAttempts = isIdempotentMethod(options.method) && !options.stream
    ? RETRY_ATTEMPTS + 1
    : 1;

  for (let attempt = 1; ; attempt += 1) {
    try {
      const result = await attemptUpstreamRequest(options);

      if (attempt >= maxAttempts || !RETRYABLE_STATUS_CODES.has(result.status)) {
        return result;
      }

      // 以前是「status >= 500 一律重试」，501/505 这类确定性错误也会白发一次请求
      console.warn(
        `[upstream] ${options.method} 上游返回 ${result.status}，第 ${attempt} 次重试`,
      );
      await sleep(resolveRetryDelayMs(attempt, result.headers));
    } catch (error) {
      if (attempt >= maxAttempts || !isRetryableError(error)) {
        throw error;
      }

      console.warn(
        `[upstream] ${options.method} 请求失败（${error instanceof Error ? error.message : String(error)}），第 ${attempt} 次重试`,
      );
      await sleep(resolveRetryDelayMs(attempt));
    }
  }
}

async function attemptUpstreamRequest(
  options: UpstreamRequestOptions & { stream?: boolean },
): Promise<UpstreamResponsePayload> {
  const timeout = createTimeoutController(options.timeoutMs);
  const { controller, cleanup } = timeout;

  try {
    const response = await fetch(options.upstreamUrl, {
      method: options.method,
      headers: {
        'Content-Type': 'application/json',
        ...(options.apiKey ? { Authorization: `Bearer ${options.apiKey}` } : {}),
      },
      body: options.body,
      signal: controller.signal,
    });

    if (options.stream) {
      return {
        status: response.status,
        headers: response.headers,
        stream: wrapStreamWithCleanup(response.body, timeout, reason => controller.abort(reason)),
      };
    }

    const body = await response.text();
    cleanup();

    return {
      status: response.status,
      headers: response.headers,
      body,
    };
  } catch (error) {
    cleanup();
    throw mapUpstreamError(error, '上游请求失败');
  }
}
