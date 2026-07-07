export class HttpError extends Error {
  public readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
  }
}

export class UpstreamRequestError extends Error {
  public readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = 'UpstreamRequestError';
    this.statusCode = statusCode;
  }
}

export function isHttpError(error: unknown): error is HttpError {
  return error instanceof HttpError;
}

export function isUpstreamRequestError(error: unknown): error is UpstreamRequestError {
  return error instanceof UpstreamRequestError;
}

export function mapUpstreamError(error: unknown, fallbackMessage: string): UpstreamRequestError {
  if (isUpstreamRequestError(error)) {
    return error;
  }

  if (error instanceof Error) {
    const code = 'code' in error && typeof error.code === 'string' ? error.code : '';
    if (
      code === 'ETIMEDOUT' ||
      code === 'ESOCKETTIMEDOUT' ||
      code === 'UND_ERR_CONNECT_TIMEOUT' ||
      error.name === 'TimeoutError' ||
      error.name === 'AbortError'
    ) {
      return new UpstreamRequestError(504, error.message || '上游请求超时');
    }

    return new UpstreamRequestError(502, error.message || fallbackMessage);
  }

  return new UpstreamRequestError(502, fallbackMessage);
}
