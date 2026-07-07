export interface ApiErrorResponseBody {
  error?: {
    message?: string;
  };
  message?: string;
}

export async function readApiJson<T>(response: Response): Promise<T> {
  if (response.ok) {
    return await response.json() as T;
  }

  let message = `请求失败 (${response.status})`;
  try {
    const data = await response.json() as ApiErrorResponseBody;
    message = data.error?.message || data.message || message;
  } catch {
    // 保留默认错误信息
  }

  throw new Error(message);
}

export async function requestJson<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  return readApiJson<T>(response);
}
