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

export interface ParseStreamChunkOptions {
  flush?: boolean;
}

function normalizeSseText(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function extractDataPayload(eventBlock: string): string | null {
  const dataLines = eventBlock
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.startsWith('data:'))
    .map(line => line.slice(5).trimStart());

  if (dataLines.length === 0) {
    return null;
  }

  return dataLines.join('\n');
}

/**
 * 解析一批 SSE 文本块，返回提取出的内容分片、usage 与剩余缓冲。
 */
export function parseStreamChunk(
  buffer: string,
  incomingText: string,
  options: ParseStreamChunkOptions = {},
): { chunks: string[]; usage: StreamUsagePayload | null; remainder: string } {
  const nextBuffer = normalizeSseText(buffer + incomingText);
  const eventBlocks = nextBuffer.split('\n\n');
  const remainder = options.flush ? '' : (eventBlocks.pop() ?? '');
  const chunks: string[] = [];
  let usage: StreamUsagePayload | null = null;

  const completedBlocks = options.flush ? eventBlocks.filter(Boolean) : eventBlocks;
  if (options.flush && remainder) {
    completedBlocks.push(remainder);
  }

  for (const eventBlock of completedBlocks) {
    const payload = extractDataPayload(eventBlock);
    if (!payload || payload === '[DONE]') {
      continue;
    }

    try {
      const data = JSON.parse(payload) as StreamChunkPayload;
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
