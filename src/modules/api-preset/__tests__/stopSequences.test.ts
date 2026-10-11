import { describe, expect, it } from 'vitest';
import { MAX_STOP_SEQUENCES } from '@/constants';
import { formatStopSequences, parseStopSequences } from '../stopSequences';

describe('parseStopSequences', () => {
  it('一行一条', () => {
    expect(parseStopSequences('###\n<|im_end|>')).toEqual(['###', '<|im_end|>']);
  });

  it('丢弃空行，末尾换行不产生空序列', () => {
    expect(parseStopSequences('A\n\nB\n')).toEqual(['A', 'B']);
  });

  it('兼容 CRLF 粘贴', () => {
    expect(parseStopSequences('A\r\nB')).toEqual(['A', 'B']);
  });

  it('解码 \\n / \\t 转义，让聊天模型常用的换行停止序列可以输入', () => {
    expect(parseStopSequences('\\n\\nUser:')).toEqual(['\n\nUser:']);
    expect(parseStopSequences('\\n\\n')).toEqual(['\n\n']);
    expect(parseStopSequences('a\\tb')).toEqual(['a\tb']);
  });

  it('解码 \\\\ 为字面反斜杠', () => {
    expect(parseStopSequences('\\\\n')).toEqual(['\\n']);
  });

  it('无法识别的转义按原样保留', () => {
    expect(parseStopSequences('C:\\path')).toEqual(['C:\\path']);
  });

  it('空白按原样保留（可能是有效序列）', () => {
    expect(parseStopSequences('  \nA ')).toEqual(['  ', 'A ']);
  });

  it(`超过 ${MAX_STOP_SEQUENCES} 条时截断到上限`, () => {
    const parsed = parseStopSequences('1\n2\n3\n4\n5\n6');
    expect(parsed).toEqual(['1', '2', '3', '4']);
    expect(parsed).toHaveLength(MAX_STOP_SEQUENCES);
  });

  it('空文本解析为空数组', () => {
    expect(parseStopSequences('')).toEqual([]);
  });
});

describe('formatStopSequences', () => {
  it('把真换行编码回 \\n，保持单行显示', () => {
    expect(formatStopSequences(['\n\nUser:', '###'])).toBe('\\n\\nUser:\n###');
  });

  it('与 parseStopSequences 往返一致', () => {
    const sequences = ['\n\nUser:', '###', 'a\tb', '\\n'];
    expect(parseStopSequences(formatStopSequences(sequences))).toEqual(sequences);
  });
});
