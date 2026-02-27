import { ref } from 'vue';
import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  ChatCompletionChunk,
  ChatMessage,
  Message,
  Preset,
} from '../types';
import { STORAGE_KEYS } from '../constants';
import {
  logApi,
  logApiError,
  logApiWarn,
  logApiRequest,
  logApiResponse,
} from '../modules/debug';
import { getStorage, setStorage } from '@/utils/storage';

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
   * 将消息格式转换为API请求格式
   */
  function convertMessagesToApiFormat(messages: Message[]): ChatMessage[] {
    return messages.map(msg => ({
      role: msg.type === 'user' ? 'user' : 'assistant',
      content: msg.content,
    }));
  }

  /**
   * 构建代理请求的 URL
   */
  function buildProxyUrl(preset: Preset, path: string): string {
    if (!preset.proxy.enabled) {
      return `${preset.url.replace(/\/$/, '')}${path}`;
    }

    const proxyUrl = preset.proxy.url.replace(/\/$/, '');
    const targetEndpoint = preset.proxy.targetEndpoint || preset.url.replace(/\/$/, '');

    if (preset.proxy.type === 'query') {
      // 查询参数方式: https://proxy.workers.dev/v1/chat/completions?endpoint=https://api.openai.com
      return `${proxyUrl}${path}?endpoint=${encodeURIComponent(targetEndpoint)}`;
    } else {
      // 请求头方式: URL 不需要特殊处理，目标端点在请求头中传递
      return `${proxyUrl}${path}`;
    }
  }

  /**
   * 构建代理请求头
   */
  function buildProxyHeaders(preset: Preset, apiKey: string | undefined): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    if (preset.proxy.enabled && preset.proxy.type === 'header') {
      const targetEndpoint = preset.proxy.targetEndpoint || preset.url.replace(/\/$/, '');
      headers['X-Target-Endpoint'] = targetEndpoint;
    }

    return headers;
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
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60秒超时

      const headers = buildProxyHeaders(preset, preset.apiKey);
      const url = buildProxyUrl(preset, '/chat/completions');

      const apiMessages: ChatMessage[] = [];

      // 如果有预构建的系统消息数组，直接使用
      if (systemMessages && systemMessages.length > 0) {
        apiMessages.push(...systemMessages);
        logApi('使用系统消息数组', { count: systemMessages.length });
      } else if (systemPrompt) {
        // 兼容旧代码，从 systemPrompt 字符串构建
        apiMessages.push({ role: 'system', content: systemPrompt });
        logApi('使用系统提示词', { length: systemPrompt.length });
      }

      // 转换聊天历史消息
      const chatMessages = convertMessagesToApiFormat(messages);
      apiMessages.push(...chatMessages);

      const requestBody: ChatCompletionRequest = {
        model: preset.model,
        messages: apiMessages,
        temperature: preset.temperature,
        max_tokens: preset.maxOutputTokens,
        stream: false,
      };

      logApiRequest(requestBody);

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        const errorMsg = `API 请求失败 (${response.status}): ${errorText || response.statusText}`;
        logApiError('请求失败', { status: response.status, text: errorText });
        throw new Error(errorMsg);
      }

      const data: ChatCompletionResponse = await response.json();

      logApiResponse(data);

      // 提取并存储 usage 数据
      if (data.usage) {
        usage.value = {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
        };
        logApi('Token 使用量', {
          prompt: data.usage.prompt_tokens,
          completion: data.usage.completion_tokens,
          total: data.usage.total_tokens,
        });
      }

      if (data.choices && data.choices.length > 0) {
        const content = data.choices[0]!.message.content;
        logApi('响应成功', { contentLength: content.length });
        return content;
      }

      throw new Error('API 返回数据格式错误');
    } catch (err) {
      let errorMessage = '请求失败';
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          errorMessage = '请求超时';
        } else if (err.message.includes('Failed to fetch')) {
          errorMessage = '网络连接失败，请检查 URL';
        } else {
          errorMessage = err.message;
        }
      }

      error.value = errorMessage;
      logApiError('请求异常', { error: err instanceof Error ? err.message : String(err) });
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
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000); // 120秒超时

      const headers = buildProxyHeaders(preset, preset.apiKey);
      const url = buildProxyUrl(preset, '/chat/completions');

      const apiMessages: ChatMessage[] = [];

      // 如果有预构建的系统消息数组，直接使用
      if (systemMessages && systemMessages.length > 0) {
        apiMessages.push(...systemMessages);
        logApi('使用系统消息数组', { count: systemMessages.length });
      } else if (systemPrompt) {
        // 兼容旧代码，从 systemPrompt 字符串构建
        apiMessages.push({ role: 'system', content: systemPrompt });
        logApi('使用系统提示词', { length: systemPrompt.length });
      }

      // 转换聊天历史消息
      const chatMessages = convertMessagesToApiFormat(messages);
      apiMessages.push(...chatMessages);

      const requestBody: ChatCompletionRequest = {
        model: preset.model,
        messages: apiMessages,
        temperature: preset.temperature,
        max_tokens: preset.maxOutputTokens,
        stream: true,
      };

      logApiRequest(requestBody);

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        const errorMsg = `API 请求失败 (${response.status}): ${errorText || response.statusText}`;
        logApiError('请求失败', { status: response.status, text: errorText });
        throw new Error(errorMsg);
      }

      if (!response.body) {
        throw new Error('无法读取响应流');
      }

      logApi('开始接收流式响应');

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let chunkCount = 0;
      let totalLength = 0;

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine || trimmedLine === 'data: [DONE]') {
            continue;
          }

          if (trimmedLine.startsWith('data: ')) {
            try {
              const jsonStr = trimmedLine.slice(6);
              const data: ChatCompletionChunk = JSON.parse(jsonStr);

              // 提取并存储 usage 数据（流式响应的最后一个 chunk 可能包含 usage）
              if (data.usage) {
                usage.value = {
                  promptTokens: data.usage.prompt_tokens,
                  completionTokens: data.usage.completion_tokens,
                  totalTokens: data.usage.total_tokens,
                };
                logApi('Token 使用量', {
                  prompt: data.usage.prompt_tokens,
                  completion: data.usage.completion_tokens,
                  total: data.usage.total_tokens,
                });
              }

              if (data.choices && data.choices.length > 0) {
                const delta = data.choices[0]!.delta;
                if (delta.content) {
                  chunkCount++;
                  totalLength += delta.content.length;
                  onChunk(delta.content);

                  if (chunkCount % 10 === 0) {
                    logApi('接收进度', { chunks: chunkCount, length: totalLength });
                  }
                }
              }
            } catch {
              // 忽略解析错误
            }
          }
        }
      }

      logApi('流式响应完成', { totalChunks: chunkCount, totalLength });

      onComplete();
    } catch (err) {
      let errorMessage = '请求失败';
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          errorMessage = '请求超时';
        } else if (err.message.includes('Failed to fetch')) {
          errorMessage = '网络连接失败，请检查 URL';
        } else {
          errorMessage = err.message;
        }
      }

      error.value = errorMessage;
      logApiError('请求异常', { error: err instanceof Error ? err.message : String(err) });
      onError(errorMessage);
    } finally {
      isLoading.value = false;
      isStreaming.value = false;
    }
  }

  /**
   * 取消当前请求（通过 AbortController 实现）
   */
  function cancelRequest() {
    // 如果需要支持取消请求，可以将 controller 暴露给外部
    // 这里暂时留空，因为 AbortController 在每次请求时都是新建的
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
