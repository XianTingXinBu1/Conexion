/**
 * 聊天 API 服务
 *
 * 提供聊天相关的 API 功能
 */

import { ApiClient, type ApiClientConfig } from './base';
import type { ChatCompletionRequest, ChatCompletionResponse, ChatMessage } from '@/types';
import { logApi, logApiError } from '@/modules/debug';
import { parseStreamChunk, type StreamUsagePayload } from './stream';

class StreamTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StreamTimeoutError';
  }
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
    options: {
      temperature?: number;
      maxTokens?: number;
      stream: boolean;
    },
  ): ChatCompletionRequest {
    return {
      model: this.model,
      messages: this.normalizeMessages(messages),
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 2048,
      stream: options.stream,
    };
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
    options: {
      temperature?: number;
      maxTokens?: number;
    } = {}
  ): Promise<ChatCompletionResponse> {
    const requestBody = this.buildRequestBody(messages, {
      temperature: options.temperature,
      maxTokens: options.maxTokens,
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
    options: {
      temperature?: number;
      maxTokens?: number;
      onChunk?: (chunk: string) => void;
      onComplete?: (meta?: { usage?: StreamUsagePayload | null }) => void | Promise<void>;
      onError?: (error: string) => void | Promise<void>;
    } = {}
  ): AsyncGenerator<string> {
    const { temperature, maxTokens, onChunk, onComplete, onError } = options;

    try {
      this.validateUrl(this.baseURL);

      const requestBody = this.buildRequestBody(messages, {
        temperature,
        maxTokens,
        stream: true,
      });

      logApiRequest(requestBody);

      this.cancelActiveStream();

      const { controller, cleanup } = this.createAbortController();
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
        const errorText = await response.text();
        const errorMessage = this.parseErrorMessage(errorText);
        const error = new Error(`API 请求失败 (${response.status}): ${errorMessage || response.statusText}`);

        logApiError('流式请求失败', { status: response.status, message: errorMessage });

        throw error;
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
      } else if (error instanceof Error) {
        errorMessage = error.name === 'AbortError' ? '请求已取消' : error.message;
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
