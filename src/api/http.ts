import { logApi, logApiError } from '@/modules/debug';
import { ApiRequestError, ApiTimeoutError, extractApiErrorMessage } from './errors';
import { LOCAL_REQUEST_TIMEOUT_MS, createTimeoutController } from './transport';

export interface LocalRequestOptions extends RequestInit {
  /** 覆盖默认超时。本地数据请求不会无限等待。 */
  timeoutMs?: number;
}

/**
 * 读取后端 JSON 响应，非 2xx 时抛出 ApiRequestError。
 *
 * 消息使用后端返回的原始文案、不加前缀：本地数据接口的调用方依赖它做语义
 * 判断。更稳的方式是读 `error.serverMessage`，保持 message 原样是为了
 * 避免行为变化。
 */
export async function readApiJson<T>(response: Response): Promise<T> {
  if (response.ok) {
    return await response.json() as T;
  }

  let serverMessage: string | undefined;

  try {
    serverMessage = extractApiErrorMessage(await response.json());
  } catch {
    // 响应体不是 JSON 时保留默认文案
  }

  throw new ApiRequestError(serverMessage ?? `请求失败 (${response.status})`, {
    status: response.status,
    serverMessage,
  });
}

/**
 * 请求本地后端接口。
 *
 * 与上游代理客户端（base.ts）共享同一套超时原语，因此本地数据请求同样
 * 有超时保护；调用方也可以传入自己的 signal 主动取消。
 */
export async function requestJson<T>(url: string, options: LocalRequestOptions = {}): Promise<T> {
  const { timeoutMs = LOCAL_REQUEST_TIMEOUT_MS, ...init } = options;
  const { controller, cleanup } = createTimeoutController(timeoutMs);
  const method = (init.method ?? 'GET').toUpperCase();

  try {
    logApi(`本地 API 请求 [${method}] ${url}`);

    const response = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...init.headers,
      },
      signal: init.signal ?? controller.signal,
    });

    const data = await readApiJson<T>(response);
    logApi('本地 API 请求成功', { url });
    return data;
  } catch (error) {
    if (error instanceof ApiTimeoutError) {
      logApiError(`本地 API 请求超时（${timeoutMs}ms）`, { url });
      throw error;
    }

    if (error instanceof ApiRequestError) {
      logApiError('本地 API 请求失败', {
        url,
        status: error.status,
        message: error.serverMessage,
      });
      throw error;
    }

    logApiError('本地 API 请求异常', {
      url,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  } finally {
    cleanup();
  }
}
