/**
 * API 客户端基类
 *
 * 提供统一的错误处理、重试机制、超时控制
 */

import { logApi, logApiError, logApiWarn } from '@/modules/debug';
import { validateUrl } from '@/utils';

export interface ApiClientConfig {
  baseURL: string;
  apiKey?: string;
  timeout?: number;
}

/**
 * API 请求选项
 */
export interface RequestOptions {
  headers?: Record<string, string>;
  signal?: AbortSignal;
  retries?: number;
}

export interface AbortControllerHandle {
  controller: AbortController;
  cleanup: () => void;
}

/**
 * API 错误类
 */
export class ApiError extends Error {
  public statusCode?: number;
  public details?: any;

  constructor(
    message: string,
    statusCode?: number,
    details?: any
  ) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

/**
 * API 客户端基类
 */
export class ApiClient {
  public baseURL: string;
  public apiKey?: string;
  public timeout: number;
  public backendBaseURL: string;

  constructor(config: ApiClientConfig) {
    this.baseURL = config.baseURL.replace(/\/$/, '');
    this.apiKey = config.apiKey;
    this.timeout = config.timeout ?? 60000;
    this.backendBaseURL = '/api';
  }

  /**
   * 验证 URL
   */
  public validateUrl(url: string): void {
    const validation = validateUrl(url);
    if (!validation.valid) {
      throw new Error(validation.error || 'URL 格式无效');
    }
  }

  public buildBackendUrl(path: string): string {
    return `${this.backendBaseURL}${path}`;
  }

  public buildHeaders(customHeaders: Record<string, string> = {}): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      ...customHeaders,
    };
  }

  /**
   * 创建 AbortController 和超时
   */
  public createAbortController(): AbortControllerHandle {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    return {
      controller,
      cleanup: () => clearTimeout(timeoutId),
    };
  }

  /**
   * 解析错误消息
   */
  public parseErrorMessage(errorText: string): string {
    try {
      const data = JSON.parse(errorText);
      return data.error?.message || data.message || errorText;
    } catch {
      return errorText;
    }
  }

  /**
   * 发送 HTTP 请求
   *
   * 不做重试。重试策略已下沉到后端代理（见 server/upstream/client.ts）：
   * 前端无从判断上游请求是否幂等，而重发 POST 会造成重复计费与重复生成。
   * 这里保留超时与取消能力。
   */
  async request<T>(
    path: string,
    options: RequestOptions = {},
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    body?: any
  ): Promise<T> {
    this.validateUrl(this.baseURL);

    const { controller, cleanup } = this.createAbortController();

    try {
      const headers = this.buildHeaders(options.headers);
      const url = this.buildBackendUrl(path);

      logApi(`API 请求 [${method}] ${url}`);

      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: options.signal ?? controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        const errorMessage = this.parseErrorMessage(errorText);

        logApiError('API 请求失败', { status: response.status, message: errorMessage });

        throw new ApiError(
          `API 请求失败 (${response.status}): ${errorMessage || response.statusText}`,
          response.status,
          { errorText }
        );
      }

      const data = await response.json();
      logApi('API 请求成功');
      return data;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          logApiWarn('API 请求已取消或超时');
          throw error;
        }

        logApiError('API 请求异常', { error: error.message });
        throw error;
      }

      throw new Error('未知错误');
    } finally {
      cleanup();
    }
  }

  /**
   * GET 请求
   */
  async get<T>(path: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>(path, options, 'GET');
  }

  /**
   * POST 请求
   */
  async post<T>(path: string, body: any, options: RequestOptions = {}): Promise<T> {
    return this.request<T>(path, options, 'POST', body);
  }

  /**
   * PUT 请求
   */
  async put<T>(path: string, body: any, options: RequestOptions = {}): Promise<T> {
    return this.request<T>(path, options, 'PUT', body);
  }

  /**
   * DELETE 请求
   */
  async delete<T>(path: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>(path, options, 'DELETE');
  }
}