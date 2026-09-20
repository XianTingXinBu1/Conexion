/**
 * API 层共享的错误类型与后端错误体解析。
 *
 * 这一层只做两件事：
 * 1. 提供唯一的「从后端错误响应里取消息」实现，避免各 client 各解析一套、
 *    同类错误得出不同文案。
 * 2. 提供唯一的错误类型，让调用方可以按 `status` 做程序化判断，
 *    而不是对 `error.message` 做字符串比较。
 *
 * 注意：这里的解析只负责取出消息，不负责决定最终展示文案。
 * 请求客户端仍按各自语境拼接前缀（本地数据接口与上游代理的展示语境不同）。
 */

export interface ApiErrorResponseBody {
  error?: {
    message?: string;
  };
  message?: string;
}

/**
 * API 请求错误。
 *
 * 仅用于「带 HTTP 状态」的失败，例如响应非 2xx。
 * 语义性失败（如流不可读、请求被取消）仍应是普通 Error，
 * 这样 `instanceof ApiRequestError` 才能准确表达「这是一次 HTTP 失败」。
 */
export class ApiRequestError extends Error {
  readonly status?: number;
  /** 后端返回的原始消息（若存在）。便于调用方做语义判断。 */
  readonly serverMessage?: string;

  constructor(message: string, options: { status?: number; serverMessage?: string } = {}) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = options.status;
    this.serverMessage = options.serverMessage;
  }
}

/**
 * 请求超时。
 *
 * 与「用户主动取消」严格区分：取消产生的是一次不带 reason 的 abort，
 * 即 AbortError。把超时单独建模，调用方才能准确上报失败原因，
 * 而不是把超时笼统地当成取消。
 */
export class ApiTimeoutError extends Error {
  constructor(message = '请求超时') {
    super(message);
    this.name = 'ApiTimeoutError';
  }
}

/**
 * 从已解析的响应体中取出后端错误消息。
 * 支持 { error: { message } } 与 { message } 两种约定。
 */
export function extractApiErrorMessage(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') {
    return undefined;
  }

  const data = body as ApiErrorResponseBody;
  const message = data.error?.message ?? data.message;

  if (typeof message !== 'string') {
    return undefined;
  }

  const trimmed = message.trim();
  return trimmed || undefined;
}

/**
 * 从响应体文本中取出后端错误消息。
 * 非 JSON 响应体会把原文当作消息返回，便于上游返回纯文本错误时仍能透出原因。
 */
export function parseApiErrorMessage(errorText: string): string | undefined {
  try {
    return extractApiErrorMessage(JSON.parse(errorText));
  } catch {
    return errorText.trim() || undefined;
  }
}
