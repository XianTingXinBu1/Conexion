/**
 * 聊天 API Composable
 *
 * 使用新的 API 服务层提供聊天功能
 */

import { computed, ref } from 'vue';
import type {
  ChatMessage,
  Preset,
} from '@/types';
import {
  logApi,
  logApiError,
  logApiWarn,
} from '@/modules/debug';
import { ChatApi, REQUEST_CANCELLED_MESSAGE, type ApiClientConfig } from '@/api';
import {
  loadApiPresets,
  loadCurrentApiPreset,
  saveSelectedApiPresetId,
} from '@/repositories/apiPresetRepository';

export type ChatRequestStatus = 'idle' | 'sending' | 'streaming' | 'cancelled' | 'error' | 'completed';

interface UsageStats {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

interface RequestTelemetry {
  startedAt: number;
  firstChunkAt: number | null;
  completedAt: number | null;
}

export function useChatApi() {
  const isLoading = ref(false);
  const isStreaming = ref(false);
  const error = ref<string | null>(null);
  const requestStatus = ref<ChatRequestStatus>('idle');
  const wasCancelled = ref(false);
  let activeChatApi: ChatApi | null = null;

  const isRequestActive = computed(() => requestStatus.value === 'sending' || requestStatus.value === 'streaming');

  const setRequestStatus = (status: ChatRequestStatus) => {
    requestStatus.value = status;
    isLoading.value = status === 'sending' || status === 'streaming';
    isStreaming.value = status === 'streaming';
  };

  // Token 使用统计
  const usage = ref<UsageStats | null>(null);
  const requestTelemetry = ref<RequestTelemetry | null>(null);

  const responseMetrics = computed(() => {
    const telemetry = requestTelemetry.value;
    if (!telemetry) {
      return null;
    }

    return {
      startedAt: telemetry.startedAt,
      firstChunkAt: telemetry.firstChunkAt,
      completedAt: telemetry.completedAt,
      timeToFirstChunkMs: telemetry.firstChunkAt !== null ? telemetry.firstChunkAt - telemetry.startedAt : null,
      totalDurationMs: telemetry.completedAt !== null ? telemetry.completedAt - telemetry.startedAt : null,
    };
  });

  /**
   * 创建 ChatApi 实例
   */
  function createChatApi(preset: Preset): ChatApi {
    const config: ApiClientConfig = {
      baseURL: preset.url,
      apiKey: preset.apiKey,
      timeout: preset.streamEnabled ? 120000 : 60000,
    };

    return new ChatApi(config, preset.model);
  }

  /**
   * 加载当前选中的预设
   */
  async function loadCurrentPreset(): Promise<Preset | null> {
    try {
      const presets = await loadApiPresets();

      if (presets.length === 0) {
        logApiWarn('API 预设列表为空');
        return null;
      }

      const preset = await loadCurrentApiPreset();

      if (!preset) {
        logApiError('未找到可用的预设');
        return null;
      }

      if (!presets.some(item => item.id === preset.id)) {
        await saveSelectedApiPresetId(preset.id);
        logApi('使用备用预设', { name: preset.name, id: preset.id });
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
  async function sendChatRequest(messages: ChatMessage[]): Promise<string> {
    error.value = null;
    wasCancelled.value = false;
    requestTelemetry.value = {
      startedAt: Date.now(),
      firstChunkAt: null,
      completedAt: null,
    };
    setRequestStatus('sending');

    logApi('开始发送聊天请求（非流式）', { messageCount: messages.length });

    const preset = await loadCurrentPreset();
    if (!preset) {
      error.value = '请先配置 API 预设';
      setRequestStatus('error');
      logApiError(error.value);
      throw new Error(error.value);
    }

    if (!preset.url || !preset.model) {
      error.value = 'API URL 和模型不能为空';
      setRequestStatus('error');
      logApiError(error.value);
      throw new Error(error.value);
    }

    try {
      const chatApi = createChatApi(preset);
      activeChatApi = chatApi;

      const response = await chatApi.sendMessage(messages, {
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
        requestTelemetry.value = {
          startedAt: requestTelemetry.value?.startedAt ?? Date.now(),
          firstChunkAt: requestTelemetry.value?.startedAt ?? Date.now(),
          completedAt: Date.now(),
        };
        setRequestStatus('completed');
        return content;
      }

      throw new Error('API 返回数据格式错误');
    } catch (err) {
      // 用户主动取消不应被当成失败：不写 error 状态，文案统一为固定值。
      const cancelled = wasCancelled.value
        || (err instanceof Error && err.name === 'AbortError');
      const errorMessage = cancelled
        ? REQUEST_CANCELLED_MESSAGE
        : (err instanceof Error ? err.message : '请求失败');

      if (cancelled) {
        logApi('已取消当前请求');
        setRequestStatus('cancelled');
        throw new Error(errorMessage);
      }

      error.value = errorMessage;
      setRequestStatus('error');
      logApiError('请求异常', { error: errorMessage });
      throw new Error(errorMessage);
    } finally {
      activeChatApi = null;
      if (requestStatus.value === 'sending') {
        setRequestStatus(wasCancelled.value ? 'cancelled' : 'idle');
      }
    }
  }

  /**
   * 发送流式聊天请求
   */
  async function sendStreamChatRequest(
    messages: ChatMessage[],
    onChunk: (chunk: string) => void,
    onComplete: () => void | Promise<void>,
    onError: (error: string) => void | Promise<void>,
  ): Promise<void> {
    error.value = null;
    wasCancelled.value = false;
    requestTelemetry.value = {
      startedAt: Date.now(),
      firstChunkAt: null,
      completedAt: null,
    };
    setRequestStatus('sending');

    logApi('开始发送聊天请求（流式）', { messageCount: messages.length });

    const preset = await loadCurrentPreset();

    // 预设加载可能包含多次网络往返，这期间 requestStatus 已经是 sending，
    // 用户看得到「停止」按钮。若此时已经取消，必须在这里就停下来，
    // 否则请求会照常发出，表现为「点了停止没有反应」。
    // 这里走 onError('请求已取消') 是为了复用调用方已有的取消收尾逻辑
    // （占位消息标记为已停止生成并落库）。
    if (wasCancelled.value) {
      logApi('预设加载期间已取消，跳过流式请求');
      await onError(REQUEST_CANCELLED_MESSAGE);
      return;
    }

    if (!preset) {
      const errorMsg = '请先配置 API 预设（包括 URL 和模型名称）并保存';
      error.value = errorMsg;
      setRequestStatus('error');
      logApiError(errorMsg);
      onError(errorMsg);
      return;
    }

    if (!preset.url) {
      const errorMsg = 'API URL 不能为空，请在 API 预设页面输入 API URL 并保存';
      error.value = errorMsg;
      setRequestStatus('error');
      logApiError(errorMsg);
      onError(errorMsg);
      return;
    }

    if (!preset.model) {
      const errorMsg = '模型名称不能为空，请在 API 预设页面输入或选择模型名称并保存';
      error.value = errorMsg;
      setRequestStatus('error');
      logApiError(errorMsg);
      onError(errorMsg);
      return;
    }

    let didNotifyError = false;
    const reportError = async (errorMessage: string) => {
      if (didNotifyError) {
        return;
      }
      didNotifyError = true;
      if (!wasCancelled.value) {
        error.value = errorMessage;
        setRequestStatus('error');
      }
      logApiError('流式请求异常', { error: errorMessage });
      await onError(errorMessage);
    };

    try {
      const chatApi = createChatApi(preset);
      activeChatApi = chatApi;

      let chunkCount = 0;
      let totalLength = 0;
      setRequestStatus('streaming');

      for await (const _chunk of chatApi.sendStreamMessage(messages, {
        temperature: preset.temperature,
        maxTokens: preset.maxOutputTokens,
        onChunk: (content) => {
          if (!requestTelemetry.value?.firstChunkAt) {
            requestTelemetry.value = {
              startedAt: requestTelemetry.value?.startedAt ?? Date.now(),
              firstChunkAt: Date.now(),
              completedAt: null,
            };
          }

          chunkCount++;
          totalLength += content.length;
          onChunk(content);

          if (chunkCount % 10 === 0) {
            logApi('接收进度', { chunks: chunkCount, length: totalLength });
          }
        },
        onComplete: async (meta) => {
          if (meta?.usage) {
            usage.value = {
              promptTokens: meta.usage.prompt_tokens,
              completionTokens: meta.usage.completion_tokens,
              totalTokens: meta.usage.total_tokens,
            };
            logApi('流式 Token 使用量', {
              prompt: meta.usage.prompt_tokens,
              completion: meta.usage.completion_tokens,
              total: meta.usage.total_tokens,
            });
          }

          requestTelemetry.value = {
            startedAt: requestTelemetry.value?.startedAt ?? Date.now(),
            firstChunkAt: requestTelemetry.value?.firstChunkAt ?? null,
            completedAt: Date.now(),
          };
          setRequestStatus('completed');
          logApi('流式响应完成', { totalChunks: chunkCount, totalLength });
          await onComplete();
        },
        onError: async (errorMessage) => {
          await reportError(errorMessage);
        },
      })) {
        // chunk 已经通过 onChunk 回调处理
      }

    } catch (err) {
      let errorMessage = '请求失败';
      if (err instanceof Error) {
        errorMessage = err.message;
      }

      await reportError(errorMessage);
    } finally {
      activeChatApi = null;
      if (requestStatus.value === 'sending' || requestStatus.value === 'streaming') {
        setRequestStatus(wasCancelled.value ? 'cancelled' : 'idle');
      }
    }
  }

  /**
   * 取消当前请求
   */
  function cancelRequest() {
    // 注意：这里不能用 activeChatApi 当「有没有请求在跑」的判据。
    // 它是在预设加载完成之后才被赋值的，用它判断会漏掉
    // 「已进入 sending 但上游请求尚未发出」的窗口，使得这段时间内
    // 点停止被静默忽略。requestStatus 才是这个窗口的真实信号。
    if (!isRequestActive.value) {
      return;
    }

    wasCancelled.value = true;
    error.value = null;
    setRequestStatus('cancelled');
    // 流式与非流式是两条不同的传输路径，都试一下；未在飞的那条是空操作。
    activeChatApi?.cancelActiveStream();
    activeChatApi?.cancelActiveRequest();
    logApi('已取消当前请求');
  }

  return {
    isLoading,
    isStreaming,
    isRequestActive,
    error,
    usage,
    requestTelemetry,
    responseMetrics,
    requestStatus,
    wasCancelled,
    sendChatRequest,
    sendStreamChatRequest,
    cancelRequest,
    resetUsage: () => {
      usage.value = null;
      requestTelemetry.value = null;
      error.value = null;
      wasCancelled.value = false;
      setRequestStatus('idle');
    },
  };
}
