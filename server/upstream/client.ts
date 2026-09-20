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
const RETRYABLE_STATUS_MIN = 500;

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

      if (attempt >= maxAttempts || result.status < RETRYABLE_STATUS_MIN) {
        return result;
      }
    } catch (error) {
      if (attempt >= maxAttempts || !isRetryableError(error)) {
        throw error;
      }
    }

    await sleep(RETRY_BASE_DELAY_MS * attempt);
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
