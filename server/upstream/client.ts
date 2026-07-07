import { UpstreamRequestError, mapUpstreamError } from '../errors';

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
