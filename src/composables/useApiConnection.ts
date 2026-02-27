import { ref } from 'vue';
import { validateUrl, getFriendlyErrorMessage } from '../utils';

export function useApiConnection() {
  const isTestingConnection = ref(false);

  // 测试连接
  async function testConnection(
    url: string,
    apiKey: string,
    proxy?: { enabled: boolean; proxyUrl: string; type: 'query' | 'header'; targetEndpoint?: string }
  ) {
    // 验证 API URL
    const urlValidation = validateUrl(url);
    if (!urlValidation.valid) {
      throw new Error(urlValidation.error || 'URL 格式无效');
    }

    // 验证代理 URL（如果启用代理）
    if (proxy?.enabled) {
      if (!proxy.proxyUrl) {
        throw new Error('请先配置代理 URL');
      }

      const proxyUrlValidation = validateUrl(proxy.proxyUrl);
      if (!proxyUrlValidation.valid) {
        throw new Error(`代理 URL 无效：${proxyUrlValidation.error || '格式错误'}`);
      }

      // 验证目标端点（如果提供了）
      if (proxy.targetEndpoint) {
        const targetValidation = validateUrl(proxy.targetEndpoint);
        if (!targetValidation.valid) {
          throw new Error(`目标端点无效：${targetValidation.error || '格式错误'}`);
        }
      }
    }

    isTestingConnection.value = true;
    try {
      let requestUrl: string;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      // 只有当有 API Key 时才添加 Authorization 头
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }

      if (proxy?.enabled) {
        const proxyBaseUrl = proxy.proxyUrl.replace(/\/$/, '');
        const targetEndpoint = proxy.targetEndpoint || url.replace(/\/$/, '');

        if (proxy.type === 'query') {
          // 查询参数方式
          requestUrl = `${proxyBaseUrl}/models?endpoint=${encodeURIComponent(targetEndpoint)}`;
        } else {
          // 请求头方式
          headers['X-Target-Endpoint'] = targetEndpoint;
          requestUrl = `${proxyBaseUrl}/models`;
        }
      } else {
        // 不使用代理
        requestUrl = `${url.replace(/\/$/, '')}/models`;
      }

      // 添加超时控制
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15秒超时

      // 记录请求开始时间
      const startTime = performance.now();

      const response = await fetch(requestUrl, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        // 计算网络延迟（毫秒）
        const latency = Math.round(performance.now() - startTime);

        return latency;
      } else {
        const errorText = await response.text();
        // 使用友好的错误消息
        const friendlyError = getFriendlyErrorMessage(errorText);
        throw new Error(`连接失败 (${response.status}): ${friendlyError || response.statusText}`);
      }
    } catch (error) {
      let errorMessage = '连接测试失败';
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          errorMessage = '请求超时，请检查网络连接';
        } else if (error.message.includes('Failed to fetch')) {
          errorMessage = '网络连接失败，请检查 URL 是否正确';
        } else {
          errorMessage = error.message;
        }
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