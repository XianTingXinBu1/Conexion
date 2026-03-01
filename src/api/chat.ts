/**
 * 聊天 API 服务
 *
 * 提供聊天相关的 API 功能
 */

import { ApiClient, type ApiClientConfig } from './base';
import type { ChatCompletionRequest, ChatCompletionResponse, ChatMessage, Message } from '@/types';
import { logApi, logApiError } from '@/modules/debug';

/**
 * 聊天 API 服务
 */
export class ChatApi extends ApiClient {
  constructor(config: ApiClientConfig) {
    super(config);
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
      model: '', // 模型名称由 ApiClient 的配置决定（这里需要特殊处理）
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
      onComplete?: () => void;
      onError?: (error: string) => void;
    } = {}
  ): AsyncGenerator<string> {
    const { systemPrompt, systemMessages, temperature, maxTokens, onChunk, onComplete, onError } = options;

    try {
      this.validateUrl(this.baseURL);
      this.validateProxy();

      const apiMessages = this.convertMessages(messages, systemPrompt, systemMessages);

      const requestBody: ChatCompletionRequest = {
        model: '',
        messages: apiMessages,
        temperature: temperature ?? 0.7,
        max_tokens: maxTokens ?? 2048,
        stream: true,
      };

      logApiRequest(requestBody);

      const controller = this.createAbortController();
      const headers = this.buildHeaders();
      const url = this.buildProxyUrl('/chat/completions');

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        const errorMessage = this.parseErrorMessage(errorText);
        const error = new Error(`API 请求失败 (${response.status}): ${errorMessage || response.statusText}`);

        logApiError('流式请求失败', { status: response.status, message: errorMessage });

        if (onError) {
          onError(error.message);
        }

        throw error;
      }

      if (!response.body) {
        const error = new Error('无法读取响应流');
        if (onError) {
          onError(error.message);
        }
        throw error;
      }

      logApi('开始接收流式响应');

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

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
              const data = JSON.parse(jsonStr);

              if (data.choices && data.choices.length > 0) {
                const delta = data.choices[0]?.delta;
                if (delta?.content) {
                  if (onChunk) {
                    onChunk(delta.content);
                  }
                  yield delta.content;
                }
              }
            } catch {
              // 忽略解析错误
            }
          }
        }
      }

      logApi('流式响应完成');

      if (onComplete) {
        onComplete();
      }

    } catch (error) {
      let errorMessage = '请求失败';
      if (error instanceof Error) {
        errorMessage = error.message;
      }

      logApiError('流式请求异常', { error: errorMessage });

      if (onError) {
        onError(errorMessage);
      }

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