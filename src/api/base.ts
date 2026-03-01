/**
 * API 客户端基类
 *
 * 提供统一的错误处理、重试机制、超时控制和代理支持
 */

import { logApi, logApiError, logApiWarn } from '@/modules/debug';
import { validateUrl } from '@/utils';

/**
 * 代理配置
 */
export interface ProxyConfig {
  enabled: boolean;
  url: string;
  type: 'query' | 'header';
  targetEndpoint?: string;
}

/**
 * API 客户端配置
 */
export interface ApiClientConfig {
  baseURL: string;
  apiKey?: string;
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
  proxy?: ProxyConfig;
}

/**
 * API 请求选项
 */
export interface RequestOptions {
  headers?: Record<string, string>;
  signal?: AbortSignal;
  retries?: number;
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
  public proxy?: ProxyConfig;

  constructor(config: ApiClientConfig) {
    this.baseURL = config.baseURL.replace(/\/$/, '');
    this.apiKey = config.apiKey;
    this.timeout = config.timeout ?? 60000; // 默认 60 秒
    this.maxRetries = config.maxRetries ?? 3;
    this.retryDelay = config.retryDelay ?? 1000;
    this.proxy = config.proxy;
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

  /**
   * 验证代理配置
   */
  public validateProxy(): void {
    if (!this.proxy?.enabled) {
      return;
    }

    if (!this.proxy.url) {
      throw new Error('请先配置代理 URL');
    }

    const proxyUrlValidation = validateUrl(this.proxy.url);
    if (!proxyUrlValidation.valid) {
      throw new Error(`代理 URL 无效：${proxyUrlValidation.error || '格式错误'}`);
    }

    if (this.proxy.targetEndpoint) {
      const targetValidation = validateUrl(this.proxy.targetEndpoint);
      if (!targetValidation.valid) {
        throw new Error(`目标端点无效：${targetValidation.error || '格式错误'}`);
      }
    }
  }

  /**
   * 构建代理请求的 URL
   */
  public buildProxyUrl(path: string): string {
    if (!this.proxy?.enabled) {
      return `${this.baseURL}${path}`;
    }

    const proxyUrl = this.proxy.url.replace(/\/$/, '');
    const targetEndpoint = this.proxy.targetEndpoint || this.baseURL;

    if (this.proxy.type === 'query') {
      return `${proxyUrl}${path}?endpoint=${encodeURIComponent(targetEndpoint)}`;
    } else {
      return `${proxyUrl}${path}`;
    }
  }

  /**
   * 构建请求头
   */
  public buildHeaders(customHeaders: Record<string, string> = {}): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...customHeaders,
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    if (this.proxy?.enabled && this.proxy.type === 'header') {
      const targetEndpoint = this.proxy.targetEndpoint || this.baseURL;
      headers['X-Target-Endpoint'] = targetEndpoint;
    }

    return headers;
  }

  /**
   * 创建 AbortController 和超时
   */
  public createAbortController(): AbortController {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), this.timeout);
    return controller;
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
        // 验证配置
        this.validateUrl(this.baseURL);
        this.validateProxy();

        // 构建请求
        const controller = this.createAbortController();
        const headers = this.buildHeaders(options.headers);
        const url = this.buildProxyUrl(path);

        logApi(`API 请求 [${method}] ${url}`, { attempt: attempt + 1, maxAttempts });

        const response = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });

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