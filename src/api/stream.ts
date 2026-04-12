/**
 * 流式响应解析工具
 */

export interface StreamUsagePayload {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface StreamChunkPayload {
  choices?: Array<{
    delta?: {
      content?: string;
    };
  }>;
  usage?: StreamUsagePayload;
}

/**
 * 解析一批 SSE 文本行，返回提取出的内容分片、usage 与剩余缓冲。
 */
export function parseStreamChunk(
  buffer: string,
  incomingText: string,
): { chunks: string[]; usage: StreamUsagePayload | null; remainder: string } {
  const nextBuffer = buffer + incomingText;
  const lines = nextBuffer.split('\n');
  const remainder = lines.pop() || '';
  const chunks: string[] = [];
  let usage: StreamUsagePayload | null = null;

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine === 'data: [DONE]') {
      continue;
    }

    if (!trimmedLine.startsWith('data: ')) {
      continue;
    }

    try {
      const jsonStr = trimmedLine.slice(6);
      const data = JSON.parse(jsonStr) as StreamChunkPayload;
      const content = data.choices?.[0]?.delta?.content;

      if (content) {
        chunks.push(content);
      }

      if (data.usage) {
        usage = data.usage;
      }
    } catch {
      // 忽略不完整或非 JSON 数据块
    }
  }

  return { chunks, usage, remainder };
}
