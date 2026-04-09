import { describe, expect, it } from 'vitest';
import { parseStreamChunk } from '../stream';

describe('parseStreamChunk', () => {
  it('extracts content chunks and keeps remainder for incomplete data', () => {
    const first = parseStreamChunk(
      '',
      `data: {"choices":[{"delta":{"content":"Hel`
    );

    expect(first.chunks).toEqual([]);
    expect(first.remainder).toBe('data: {"choices":[{"delta":{"content":"Hel');

    const second = parseStreamChunk(
      first.remainder,
      `lo"}}]}\n\ndata: {"choices":[{"delta":{"content":" world"}}]}\n`
    );

    expect(second.chunks).toEqual(['Hello', ' world']);
    expect(second.remainder).toBe('');
  });

  it('ignores done markers and invalid json lines', () => {
    const result = parseStreamChunk(
      '',
      'data: not-json\n\ndata: [DONE]\n\ndata: {"choices":[{"delta":{"content":"ok"}}]}\n'
    );

    expect(result.chunks).toEqual(['ok']);
    expect(result.remainder).toBe('');
  });
});
