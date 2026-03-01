/**
 * 聊天 API Composable
 *
 * 使用新的 API 服务层提供聊天功能
 */

import { ref } from 'vue';
import type {
  ChatMessage,
  Message,
  Preset,
} from '../types';
import { STORAGE_KEYS } from '../constants';
import {
  logApi,
  logApiError,
  logApiWarn,
} from '../modules/debug';
import { getStorage, setStorage } from '@/utils/storage';
import { ChatApi, type ApiClientConfig } from '@/api';

export function useChatApi() {
  const isLoading = ref(false);
  const isStreaming = ref(false);
  const error = ref<string | null>(null);

  // Token 使用统计
  const usage = ref<{
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  } | null>(null);

  /**
   * 创建 ChatApi 实例
   */
  function createChatApi(preset: Preset): ChatApi {
    const config: ApiClientConfig = {
      baseURL: preset.url,
      apiKey: preset.apiKey,
      timeout: preset.streamEnabled ? 120000 : 60000, // 流式 120 秒，非流式 60 秒
      maxRetries: 3,
      retryDelay: 1000,
      proxy: preset.proxy.enabled ? {
        enabled: preset.proxy.enabled,
        url: preset.proxy.url,
        type: preset.proxy.type,
        targetEndpoint: preset.proxy.targetEndpoint,
      } : undefined,
    };

    return new ChatApi(config);
  }

  /**
   * 加载当前选中的预设
   */
  async function loadCurrentPreset(): Promise<Preset | null> {
    try {
      // 1. 加载预设列表
      const presets = await getStorage<Preset[]>(STORAGE_KEYS.API_PRESETS, []);

      if (presets.length === 0) {
        logApiWarn('API 预设列表为空');
        return null;
      }

      // 2. 加载或设置选中的预设ID
      let selectedPresetId = await getStorage<string>(STORAGE_KEYS.SELECTED_PRESET, '');

      if (!selectedPresetId) {
        selectedPresetId = presets[0]!.id;
        await setStorage(STORAGE_KEYS.SELECTED_PRESET, selectedPresetId);
      }

      // 3. 查找预设
      const preset = presets.find((p: Preset) => p.id === selectedPresetId);

      if (!preset) {
        // 尝试使用第一个预设
        const fallbackPreset = presets[0];
        if (fallbackPreset) {
          await setStorage(STORAGE_KEYS.SELECTED_PRESET, fallbackPreset.id);
          logApi('使用备用预设', { name: fallbackPreset.name, id: fallbackPreset.id });
          return fallbackPreset;
        }
        logApiError('未找到可用的预设');
        return null;
      }

      // 检查必需字段
      if (!preset.url || !preset.model) {
        logApiWarn('预设配置不完整', { hasUrl: !!preset.url, hasModel: !!preset.model });
        return null;
      }

      logApi('加载预设', { name: preset.name, model: preset.model, url: preset.url });

      return preset;
    } catch (error) {
      logApiError('加载预设失败', { error });
      return null;
    }
  }

  /**
   * 发送聊天请求（非流式）
   */
  async function sendChatRequest(
    messages: Message[],
    systemPrompt?: string,
    systemMessages?: ChatMessage[]
  ): Promise<string> {
    isLoading.value = true;
    error.value = null;

    logApi('开始发送聊天请求（非流式）', { messageCount: messages.length });

    const preset = await loadCurrentPreset();
    if (!preset) {
      error.value = '请先配置 API 预设';
      isLoading.value = false;
      logApiError(error.value);
      throw new Error(error.value);
    }

    if (!preset.url || !preset.model) {
      error.value = 'API URL 和模型不能为空';
      isLoading.value = false;
      logApiError(error.value);
      throw new Error(error.value);
    }

    if (preset.proxy.enabled && !preset.proxy.url) {
      error.value = '请先配置代理 URL';
      isLoading.value = false;
      logApiError(error.value);
      throw new Error(error.value);
    }

    try {
      const chatApi = createChatApi(preset);

      const response = await chatApi.sendMessage(messages, {
        systemPrompt,
        systemMessages,
        temperature: preset.temperature,
        maxTokens: preset.maxOutputTokens,
      });

      logApi('响应成功', { contentLength: response.choices[0]?.message.content?.length || 0 });

      // 提取并存储 usage 数据
      if (response.usage) {
        usage.value = {
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens,
        };
        logApi('Token 使用量', {
          prompt: response.usage.prompt_tokens,
          completion: response.usage.completion_tokens,
          total: response.usage.total_tokens,
        });
      }

      if (response.choices && response.choices.length > 0) {
        const content = response.choices[0]!.message.content;
        return content;
      }

      throw new Error('API 返回数据格式错误');
    } catch (err) {
      let errorMessage = '请求失败';
      if (err instanceof Error) {
        errorMessage = err.message;
      }

      error.value = errorMessage;
      logApiError('请求异常', { error: errorMessage });
      throw new Error(errorMessage);
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * 发送流式聊天请求
   */
  async function sendStreamChatRequest(
    messages: Message[],
    onChunk: (chunk: string) => void,
    onComplete: () => void,
    onError: (error: string) => void,
    systemPrompt?: string,
    systemMessages?: ChatMessage[]
  ): Promise<void> {
    isLoading.value = true;
    isStreaming.value = true;
    error.value = null;

    logApi('开始发送聊天请求（流式）', { messageCount: messages.length });

    const preset = await loadCurrentPreset();
    if (!preset) {
      const errorMsg = '请先配置 API 预设（包括 URL 和模型名称）并保存';
      error.value = errorMsg;
      isLoading.value = false;
      isStreaming.value = false;
      logApiError(errorMsg);
      onError(errorMsg);
      return;
    }

    if (!preset.url) {
      const errorMsg = 'API URL 不能为空，请在 API 预设页面输入 API URL 并保存';
      error.value = errorMsg;
      isLoading.value = false;
      isStreaming.value = false;
      logApiError(errorMsg);
      onError(errorMsg);
      return;
    }

    if (!preset.model) {
      const errorMsg = '模型名称不能为空，请在 API 预设页面输入或选择模型名称并保存';
      error.value = errorMsg;
      isLoading.value = false;
      isStreaming.value = false;
      logApiError(errorMsg);
      onError(errorMsg);
      return;
    }

    if (preset.proxy.enabled && !preset.proxy.url) {
      const errorMsg = '请先配置代理 URL';
      error.value = errorMsg;
      isLoading.value = false;
      isStreaming.value = false;
      logApiError(errorMsg);
      onError(errorMsg);
      return;
    }

    try {
      const chatApi = createChatApi(preset);

      let chunkCount = 0;
      let totalLength = 0;

      for await (const _chunk of chatApi.sendStreamMessage(messages, {
        systemPrompt,
        systemMessages,
        temperature: preset.temperature,
        maxTokens: preset.maxOutputTokens,
        onChunk: (content) => {
          chunkCount++;
          totalLength += content.length;
          onChunk(content);

          if (chunkCount % 10 === 0) {
            logApi('接收进度', { chunks: chunkCount, length: totalLength });
          }
        },
        onComplete: () => {
          logApi('流式响应完成', { totalChunks: chunkCount, totalLength });
          onComplete();
        },
        onError: (errorMessage) => {
          logApiError('流式请求异常', { error: errorMessage });
          onError(errorMessage);
        },
      })) {
        // chunk 已经通过 onChunk 回调处理
      }

    } catch (err) {
      let errorMessage = '请求失败';
      if (err instanceof Error) {
        errorMessage = err.message;
      }

      error.value = errorMessage;
      logApiError('请求异常', { error: errorMessage });
      onError(errorMessage);
    } finally {
      isLoading.value = false;
      isStreaming.value = false;
    }
  }

  /**
   * 取消当前请求
   */
  function cancelRequest() {
    // 如果需要支持取消请求，可以将 controller 暴露给外部
    // ChatApi 已经支持 AbortSignal，这里暂时留空
  }

  return {
    isLoading,
    isStreaming,
    error,
    usage,
    sendChatRequest,
    sendStreamChatRequest,
    cancelRequest,
    resetUsage: () => {
      usage.value = null;
    },
  };
}