/**
 * 流式响应解析工具
 */

export interface StreamChunkPayload {
  choices?: Array<{
    delta?: {
      content?: string;
    };
  }>;
}

/**
 * 解析一批 SSE 文本行，返回提取出的内容分片与剩余缓冲。
 */
export function parseStreamChunk(
  buffer: string,
  incomingText: string,
): { chunks: string[]; remainder: string } {
  const nextBuffer = buffer + incomingText;
  const lines = nextBuffer.split('\n');
  const remainder = lines.pop() || '';
  const chunks: string[] = [];

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
    } catch {
      // 忽略不完整或非 JSON 数据块
    }
  }

  return { chunks, remainder };
}
