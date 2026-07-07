/**
 * 模型 API 服务
 *
 * 提供模型相关的 API 功能
 */

import { ApiClient, type ApiClientConfig } from './base';
import type { Model } from '@/types';
import { logApi, logApiError } from '@/modules/debug';

/**
 * 模型 API 服务
 */
export class ModelsApi extends ApiClient {
  constructor(config: ApiClientConfig) {
    super(config);
  }

  /**
   * 获取模型列表
   */
  async getModels(): Promise<Model[]> {
    try {
      logApi('获取模型列表');

      const data = await this.post<any>('/models', {
        baseURL: this.baseURL,
        apiKey: this.apiKey,
      });

      // 支持多种响应格式
      let modelList: any[] = [];

      if (data.data && Array.isArray(data.data)) {
        // OpenAI 格式: { data: [{ id, ... }] }
        modelList = data.data;
      } else if (Array.isArray(data)) {
        // 直接返回数组格式: [{ id, ... }]
        modelList = data;
      } else if (data.models && Array.isArray(data.models)) {
        // 其他格式: { models: [{ id, ... }] }
        modelList = data.models;
      } else {
        throw new Error('响应格式无法识别');
      }

      if (modelList.length === 0) {
        logApiError('未找到可用模型');
        throw new Error('未找到可用模型');
      }

      const models: Model[] = modelList.map((m: any) => ({
        id: m.id || m.name,
        name: m.name || m.id || m.model,
        description: m.description || '',
        contextLength: m.context_length || m.max_tokens || undefined,
      }));

      logApi('获取模型列表成功', { count: models.length });

      return models;

    } catch (error) {
      logApiError('获取模型列表失败', { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  /**
   * 测试连接
   */
  async testConnection(): Promise<{ latency: number; success: boolean }> {
    const startTime = performance.now();

    try {
      logApi('测试连接');

      await this.testBackendConnection();

      const latency = Math.round(performance.now() - startTime);

      logApi('连接测试成功', { latency });

      return {
        latency,
        success: true,
      };

    } catch (error) {
      logApiError('连接测试失败', { error: error instanceof Error ? error.message : String(error) });

      return {
        latency: Math.round(performance.now() - startTime),
        success: false,
      };
    }
  }

  /**
   * 通过内建后端执行连接测试
   */
  private async testBackendConnection(): Promise<void> {
    this.validateUrl(this.baseURL);

    const { controller, cleanup } = this.createAbortController();
    const headers = this.buildHeaders();
    const url = this.buildBackendUrl('/connection-test');

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          baseURL: this.baseURL,
          apiKey: this.apiKey,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorMessage = this.parseErrorMessage(await response.text());
        throw new Error(`连接测试失败 (${response.status}): ${errorMessage || response.statusText}`);
      }
    } finally {
      cleanup();
    }
  }
}