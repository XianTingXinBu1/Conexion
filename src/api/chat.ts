/**
 * 聊天 API 服务
 *
 * 提供聊天相关的 API 功能
 */

import { ApiClient, type ApiClientConfig } from './base';
import type { ChatCompletionRequest, ChatCompletionResponse, ChatMessage } from '@/types';
import { logApi, logApiError } from '@/modules/debug';
import { parseStreamChunk, type StreamUsagePayload } from './stream';
import { ApiRequestError, ApiTimeoutError, REQUEST_CANCELLED_MESSAGE, parseApiErrorMessage } from './errors';
import { createTimeoutController } from './transport';

class StreamTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StreamTimeoutError';
  }
}

/**
 * 采样参数。
 *
 * [OI] 字段名的映射集中在这里，避免每个调用方各自拼装请求体、
 * 也避免新增参数时漏掉某条调用路径。
 */
export interface ChatSamplingOptions {
  temperature?: number;
  maxTokens?: number;
  /** 核采样阈值，对应 `top_p`。 */
  topP?: number;
  /** 频率惩罚，对应 `frequency_penalty`。 */
  frequencyPenalty?: number;
  /** 存在惩罚，对应 `presence_penalty`。 */
  presencePenalty?: number;
  /** 停止序列，对应 `stop`。 */
  stopSequences?: string[];
  /** 随机种子，对应 `seed`。 */
  seed?: number;
}

/**
 * 聊天 API 服务
 */
export class ChatApi extends ApiClient {
  private model: string;
  private activeStreamCleanup: (() => void) | null = null;

  constructor(config: ApiClientConfig, model: string) {
    super(config);
    this.model = model;
  }

  cancelActiveStream(): void {
    this.activeStreamCleanup?.();
    this.activeStreamCleanup = null;
  }

  private normalizeMessages(messages: ChatMessage[]): ChatMessage[] {
    return messages.map(message => ({
      role: message.role,
      content: message.content,
    }));
  }

  private buildRequestBody(
    messages: ChatMessage[],
    options: ChatSamplingOptions & { stream: boolean },
  ): ChatCompletionRequest {
    const body: ChatCompletionRequest = {
      model: this.model,
      messages: this.normalizeMessages(messages),
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 2048,
      top_p: options.topP ?? 1,
      frequency_penalty: options.frequencyPenalty ?? 0,
      presence_penalty: options.presencePenalty ?? 0,
      stream: options.stream,
    };

    // 空数组对上游没有意义（部分实现会直接报错），留空就不发这个字段。
    const stop = (options.stopSequences ?? []).filter(sequence => sequence !== '');
    if (stop.length > 0) {
      body.stop = stop;
    }

    // 不设种子时必须省略：发 null 或 0 都是「固定种子」，会让每次输出都一样。
    if (options.seed !== undefined) {
      body.seed = options.seed;
    }

    if (options.stream) {
      // 流式响应默认不一定带 usage，必须显式请求，否则 Token 面板拿不到真实用量。
      body.stream_options = { include_usage: true };
    }

    return body;
  }

  private getStreamIdleTimeoutMs(): number {
    return Math.min(this.timeout, 30000);
  }

  private readStreamChunk(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    timeoutMs: number,
    onTimeout: () => void,
  ): Promise<ReadableStreamReadResult<Uint8Array>> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        onTimeout();
        reject(new StreamTimeoutError('流式响应空闲超时'));
      }, timeoutMs);

      reader.read().then(
        (result) => {
          clearTimeout(timeoutId);
          resolve(result);
        },
        (error) => {
          clearTimeout(timeoutId);
          reject(error);
        },
      );
    });
  }

  /**
   * 发送聊天请求（非流式）
   */
  async sendMessage(
    messages: ChatMessage[],
    options: ChatSamplingOptions = {}
  ): Promise<ChatCompletionResponse> {
    const requestBody = this.buildRequestBody(messages, {
      ...options,
      stream: false,
    });

    logApiRequest(requestBody);

    return this.post<ChatCompletionResponse>('/chat/completions', {
      ...requestBody,
      baseURL: this.baseURL,
      apiKey: this.apiKey,
    });
  }

  /**
   * 发送流式聊天请求
   */
  async *sendStreamMessage(
    messages: ChatMessage[],
    options: ChatSamplingOptions & {
      onChunk?: (chunk: string) => void;
      onComplete?: (meta?: { usage?: StreamUsagePayload | null }) => void | Promise<void>;
      onError?: (error: string) => void | Promise<void>;
    } = {}
  ): AsyncGenerator<string> {
    const { onChunk, onComplete, onError, ...sampling } = options;

    try {
      this.validateUrl(this.baseURL);

      const requestBody = this.buildRequestBody(messages, {
        ...sampling,
        stream: true,
      });

      logApiRequest(requestBody);

      this.cancelActiveStream();

      const { controller, cleanup } = createTimeoutController(this.timeout);
      this.activeStreamCleanup = () => {
        controller.abort();
        cleanup();
      };

      const headers = this.buildHeaders();
      const url = this.buildBackendUrl('/chat/completions');

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ...requestBody,
          baseURL: this.baseURL,
          apiKey: this.apiKey,
        }),
        signal: controller.signal,
      });

      cleanup();

      if (!response.ok) {
        const serverMessage = parseApiErrorMessage(await response.text());

        logApiError('流式请求失败', { status: response.status, message: serverMessage });

        throw new ApiRequestError(
          `API 请求失败 (${response.status}): ${serverMessage || response.statusText}`,
          { status: response.status, serverMessage }
        );
      }

      if (!response.body) {
        throw new Error('无法读取响应流');
      }

      logApi('开始接收流式响应');

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      const streamStartedAt = Date.now();
      let buffer = '';
      let latestUsage: StreamUsagePayload | null = null;

      try {
        while (true) {
          const elapsed = Date.now() - streamStartedAt;
          if (elapsed >= this.timeout) {
            throw new StreamTimeoutError('流式响应超时');
          }

          const idleTimeoutMs = Math.min(this.getStreamIdleTimeoutMs(), Math.max(this.timeout - elapsed, 1));
          const { done, value } = await this.readStreamChunk(reader, idleTimeoutMs, () => {
            controller.abort();
          });

          if (done) {
            break;
          }

          const parsed = parseStreamChunk(buffer, decoder.decode(value, { stream: true }));
          buffer = parsed.remainder;
          if (parsed.usage) {
            latestUsage = parsed.usage;
          }

          for (const content of parsed.chunks) {
            onChunk?.(content);
            yield content;
          }
        }

        const finalText = decoder.decode();
        if (finalText || buffer) {
          const parsed = parseStreamChunk(buffer, finalText, { flush: true });
          buffer = parsed.remainder;
          if (parsed.usage) {
            latestUsage = parsed.usage;
          }

          for (const content of parsed.chunks) {
            onChunk?.(content);
            yield content;
          }
        }

        logApi('流式响应完成');
        await onComplete?.({ usage: latestUsage });
      } finally {
        this.activeStreamCleanup = null;
        reader.releaseLock();
      }

    } catch (error) {
      let errorMessage = '请求失败';
      if (error instanceof StreamTimeoutError) {
        errorMessage = error.message;
      } else if (error instanceof ApiTimeoutError) {
        // 总请求超时。必须与用户主动取消（AbortError）区分开，
        // 否则会把超时误报成「请求已取消」。
        errorMessage = error.message;
      } else if (error instanceof Error) {
        errorMessage = error.name === 'AbortError' ? REQUEST_CANCELLED_MESSAGE : error.message;
      }

      logApiError('流式请求异常', { error: errorMessage });
      await onError?.(errorMessage);
      this.activeStreamCleanup = null;

      throw new Error(errorMessage);
    }
  }
}

/**
 * 辅助函数：记录 API 请求日志
 */
function logApiRequest(requestBody: ChatCompletionRequest): void {
  logApi('发送聊天请求', {
    messageCount: requestBody.messages.length,
    temperature: requestBody.temperature,
    maxTokens: requestBody.max_tokens,
    stream: requestBody.stream,
  });
}
