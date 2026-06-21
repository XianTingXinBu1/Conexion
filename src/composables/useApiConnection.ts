/**
 * API 连接测试 Composable
 *
 * 使用新的 API 服务层提供连接测试功能
 */

import { ref } from 'vue';
import { ModelsApi, type ApiClientConfig } from '@/api';

export function useApiConnection() {
  const isTestingConnection = ref(false);

  /**
   * 测试连接
   */
  async function testConnection(
    url: string,
    apiKey: string,
  ): Promise<number> {
    const config: ApiClientConfig = {
      baseURL: url,
      apiKey,
      timeout: 15000,
      maxRetries: 1,
      retryDelay: 500,
    };

    const modelsApi = new ModelsApi(config);
    isTestingConnection.value = true;

    try {
      const result = await modelsApi.testConnection();

      if (!result.success) {
        throw new Error('连接失败');
      }

      return result.latency;
    } catch (error) {
      let errorMessage = '连接测试失败';
      if (error instanceof Error) {
        errorMessage = error.message;
      }

      throw new Error(errorMessage);
    } finally {
      isTestingConnection.value = false;
    }
  }

  return {
    isTestingConnection,
    testConnection,
  };
}