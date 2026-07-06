/**
 * 聊天 API 服务
 *
 * 提供聊天相关的 API 功能
 */

import { ApiClient, type ApiClientConfig } from './base';
import type { ChatCompletionRequest, ChatCompletionResponse, ChatMessage, Message } from '@/types';
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

  /**
   * 转换消息格式
   */
  private convertMessages(messages: Message[], systemPrompt?: string, systemMessages?: ChatMessage[]): ChatMessage[] {
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
    const chatMessages: ChatMessage[] = messages.map(msg => ({
      role: (msg.type === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: msg.content,
    }));

    apiMessages.push(...chatMessages);

    return apiMessages;
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
    messages: Message[],
    options: {
      systemPrompt?: string;
      systemMessages?: ChatMessage[];
      temperature?: number;
      maxTokens?: number;
    } = {}
  ): Promise<ChatCompletionResponse> {
    const { systemPrompt, systemMessages, temperature, maxTokens } = options;

    const apiMessages = this.convertMessages(messages, systemPrompt, systemMessages);

    const requestBody: ChatCompletionRequest = {
      model: this.model,
      messages: apiMessages,
      temperature: temperature ?? 0.7,
      max_tokens: maxTokens ?? 2048,
      stream: false,
    };

    logApiRequest(requestBody);

    return this.post<ChatCompletionResponse>('/chat/completions', requestBody);
  }

  /**
   * 发送流式聊天请求
   */
  async *sendStreamMessage(
    messages: Message[],
    options: {
      systemPrompt?: string;
      systemMessages?: ChatMessage[];
      temperature?: number;
      maxTokens?: number;
      onChunk?: (chunk: string) => void;
      onComplete?: (meta?: { usage?: StreamUsagePayload | null }) => void;
      onError?: (error: string) => void;
    } = {}
  ): AsyncGenerator<string> {
    const { systemPrompt, systemMessages, temperature, maxTokens, onChunk, onComplete, onError } = options;

    try {
      this.validateUrl(this.baseURL);

      const apiMessages = this.convertMessages(messages, systemPrompt, systemMessages);

      const requestBody: ChatCompletionRequest = {
        model: this.model,
        messages: apiMessages,
        temperature: temperature ?? 0.7,
        max_tokens: maxTokens ?? 2048,
        stream: true,
      };

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
        onComplete?.({ usage: latestUsage });
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
      onError?.(errorMessage);
      this.activeStreamCleanup = null;

      throw new Error(errorMessage);
    }
  }
}

/**
 * 辅助函数：记录 API 请求日志
 */
function logApiRequest(requestBody: any): void {
  logApi('发送聊天请求', {
    messageCount: requestBody.messages.length,
    temperature: requestBody.temperature,
    maxTokens: requestBody.maxTokens,
    stream: requestBody.stream,
  });
}
