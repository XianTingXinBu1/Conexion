import { describe, expect, it } from 'vitest';
import { parseStreamChunk } from '../stream';

describe('parseStreamChunk', () => {
  it('keeps native reasoning separate from answer content across fragmented events', () => {
    const first = parseStreamChunk('', 'data: {"choices":[{"delta":{"reasoning_content":"思');
    const result = parseStreamChunk(first.remainder,
      '考"}}]}\n\ndata: {"choices":[{"delta":{"reasoning":"继续","content":"答案"}}]}', { flush: true });
    expect(result.reasoningChunks).toEqual(['思考', '继续']);
    expect(result.chunks).toEqual(['答案']);
  });
  it('extracts content chunks and keeps remainder for incomplete data', () => {
    const first = parseStreamChunk(
      '',
      `data: {"choices":[{"delta":{"content":"Hel`
    );

    expect(first.chunks).toEqual([]);
    expect(first.remainder).toBe('data: {"choices":[{"delta":{"content":"Hel');

    const second = parseStreamChunk(
      first.remainder,
      `lo"}}]}\n\ndata: {"choices":[{"delta":{"content":" world"}}]}\n\n`
    );

    expect(second.chunks).toEqual(['Hello', ' world']);
    expect(second.remainder).toBe('');
  });

  it('ignores done markers and invalid json lines', () => {
    const result = parseStreamChunk(
      '',
      'data: not-json\n\ndata: [DONE]\n\ndata: {"choices":[{"delta":{"content":"ok"}}]}\n\n'
    );

    expect(result.chunks).toEqual(['ok']);
    expect(result.remainder).toBe('');
  });

  it('supports CRLF event separators and final flush without trailing newline', () => {
    const decoderText =
      'data: {"choices":[{"delta":{"content":"你"}}]}\r\n\r\n' +
      'data: {"choices":[{"delta":{"content":"好"}}],"usage":{"prompt_tokens":1,"completion_tokens":2,"total_tokens":3}}';

    const result = parseStreamChunk('', decoderText, { flush: true });

    expect(result.chunks).toEqual(['你', '好']);
    expect(result.usage).toEqual({
      prompt_tokens: 1,
      completion_tokens: 2,
      total_tokens: 3,
    });
    expect(result.remainder).toBe('');
  });

  it('retains incomplete utf8 fragments until flushed by decoder output', () => {
    const partial = parseStreamChunk('', 'data: {"choices":[{"delta":{"content":"你');
    expect(partial.chunks).toEqual([]);

    const completed = parseStreamChunk(partial.remainder, '好"}}]}', { flush: true });
    expect(completed.chunks).toEqual(['你好']);
    expect(completed.remainder).toBe('');
  });
});
