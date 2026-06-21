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
  maxRetries?: number;
  retryDelay?: number;
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
  public maxRetries: number;
  public retryDelay: number;
  public backendBaseURL: string;

  constructor(config: ApiClientConfig) {
    this.baseURL = config.baseURL.replace(/\/$/, '');
    this.apiKey = config.apiKey;
    this.timeout = config.timeout ?? 60000;
    this.maxRetries = config.maxRetries ?? 3;
    this.retryDelay = config.retryDelay ?? 1000;
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
   * 延迟函数
   */
  public delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 判断是否应该重试
   */
  public shouldRetry(error: Error, attempt: number): boolean {
    if (attempt >= this.maxRetries) {
      return false;
    }

    // 网络错误可以重试
    if (error.message.includes('Failed to fetch') || error.message.includes('network')) {
      return true;
    }

    // 5xx 服务器错误可以重试
    if (error instanceof ApiError && error.statusCode && error.statusCode >= 500) {
      return true;
    }

    // 408 请求超时可以重试
    if (error instanceof ApiError && error.statusCode === 408) {
      return true;
    }

    return false;
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
   */
  async request<T>(
    path: string,
    options: RequestOptions = {},
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    body?: any
  ): Promise<T> {
    const maxAttempts = this.maxRetries + 1;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        this.validateUrl(this.baseURL);

        const { controller, cleanup } = this.createAbortController();
        const headers = this.buildHeaders(options.headers);
        const url = this.buildBackendUrl(path);

        logApi(`API 请求 [${method}] ${url}`, { attempt: attempt + 1, maxAttempts });

        const response = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
          signal: options.signal ?? controller.signal,
        });

        cleanup();

        // 检查响应状态
        if (!response.ok) {
          const errorText = await response.text();
          const errorMessage = this.parseErrorMessage(errorText);
          const error = new ApiError(
            `API 请求失败 (${response.status}): ${errorMessage || response.statusText}`,
            response.status,
            { errorText }
          );

          // 判断是否应该重试
          if (this.shouldRetry(error, attempt)) {
            logApiWarn(`请求失败，准备重试 (${attempt + 1}/${this.maxRetries})`, {
              status: response.status,
              message: errorMessage,
            });

            await this.delay(this.retryDelay * (attempt + 1)); // 指数退避
            continue;
          }

          logApiError('API 请求失败', { status: response.status, message: errorMessage });
          throw error;
        }

        // 解析响应
        const data = await response.json();
        logApi('API 请求成功');
        return data;

      } catch (error) {
        if (error instanceof Error) {
          if (error.name === 'AbortError') {
            logApiWarn('API 请求已取消或超时');
            throw error;
          }

          // 判断是否应该重试
          if (this.shouldRetry(error, attempt)) {
            logApiWarn(`请求失败，准备重试 (${attempt + 1}/${this.maxRetries})`, {
              message: error.message,
            });

            await this.delay(this.retryDelay * (attempt + 1));
            continue;
          }

          logApiError('API 请求异常', { error: error.message });
          throw error;
        }

        throw new Error('未知错误');
      }
    }

    throw new Error('请求失败，已达到最大重试次数');
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