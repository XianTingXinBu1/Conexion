import { MAX_STOP_SEQUENCES } from '../../constants';

/**
 * 停止序列在 UI 里是「一行一条」，在 [OI] 请求体里是 `string[]`。
 *
 * 转换规则集中在这一处，别在组件里重写。两个关键点：
 *
 * 1. **一行一条**：去掉行尾 `\r`（Windows 粘贴过来的是 CRLF）、丢弃空行
 *    （末尾换行、中间空行都很常见，不该变成一条空序列）、按 [OI] 上限截断，
 *    避免发出去被上游 400。
 * 2. **支持 `\n` / `\r` / `\t` / `\\` 转义**：一行一条的输入框打不出真正的换行，
 *    而聊天模型最常用的停止序列恰恰是 `"\n\n"` 和 `"\n\nUser:"`。不提供转义的话，
 *    最该支持的用法反而表达不了。反向转换会把真换行编码回 `\n`，保证往返一致。
 *
 * 故意不做 `trim()`：序列里的空白可能是有意义的（比如两个换行结尾）。
 */
export function parseStopSequences(text: string): string[] {
  return text
    .split('\n')
    .map(line => line.replace(/\r$/, ''))
    .filter(line => line !== '')
    .map(decodeEscapes)
    .slice(0, MAX_STOP_SEQUENCES);
}

/** 停止序列数组 → 文本框内容（真换行编码回 `\n`，才能显示在同一行里）。 */
export function formatStopSequences(sequences: string[]): string {
  return sequences.map(encodeEscapes).join('\n');
}

function decodeEscapes(line: string): string {
  return line.replace(/\\(n|r|t|\\)/g, (_match, escaped: string) => {
    switch (escaped) {
      case 'n':
        return '\n';
      case 'r':
        return '\r';
      case 't':
        return '\t';
      default:
        return '\\';
    }
  });
}

function encodeEscapes(sequence: string): string {
  return sequence
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}
