/**
 * API 客户端基类
 *
 * 提供统一的错误处理与超时控制。
 * 不承担重试：重试策略由后端代理按幂等性决定，见 server/upstream/client.ts。
 */

import { logApi, logApiError, logApiWarn } from '@/modules/debug';
import { validateUrl } from '@/utils';
import { ApiRequestError, ApiTimeoutError, parseApiErrorMessage } from './errors';
import { createTimeoutController } from './transport';

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
}

/**
 * API 客户端基类
 */
export class ApiClient {
  public baseURL: string;
  public apiKey?: string;
  public timeout: number;
  public backendBaseURL: string;

  /**
   * 当前非流式请求的中止句柄。
   *
   * 同一实例同时只应有一次请求在飞（调用方每次发送都会新建实例），
   * 因此用单个句柄足够；新的请求会接管它。
   */
  private activeRequestAbort: (() => void) | null = null;

  constructor(config: ApiClientConfig) {
    this.baseURL = config.baseURL.replace(/\/$/, '');
    this.apiKey = config.apiKey;
    this.timeout = config.timeout ?? 60000;
    this.backendBaseURL = '/api';
  }

  /**
   * 取消当前进行中的非流式请求。请求会以 AbortError 结束。
   *
   * 与 cancelActiveStream 对称：流式与非流式是两条不同的传输路径，
   * 调用方通常两条都试一下即可，未在飞的那条是空操作。
   */
  public cancelActiveRequest(): void {
    this.activeRequestAbort?.();
    this.activeRequestAbort = null;
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

    const { controller, cleanup } = createTimeoutController(this.timeout);
    this.activeRequestAbort = () => controller.abort();

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
        const serverMessage = parseApiErrorMessage(await response.text());

        logApiError('API 请求失败', { status: response.status, message: serverMessage });

        throw new ApiRequestError(
          `API 请求失败 (${response.status}): ${serverMessage || response.statusText}`,
          { status: response.status, serverMessage }
        );
      }

      const data = await response.json();
      logApi('API 请求成功');
      return data;
    } catch (error) {
      if (error instanceof ApiRequestError) {
        throw error;
      }

      if (error instanceof ApiTimeoutError) {
        logApiError(`API 请求超时（${this.timeout}ms）`);
        throw error;
      }

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          logApiWarn('API 请求已取消');
          throw error;
        }

        logApiError('API 请求异常', { error: error.message });
        throw error;
      }

      throw new Error('未知错误');
    } finally {
      this.activeRequestAbort = null;
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