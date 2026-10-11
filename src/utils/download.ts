/**
 * 浏览器端文本文件下载
 *
 * 只负责触发下载，不做格式判断：调用方决定文件名与内容。
 */

export function downloadTextFile(fileName: string, content: string, mimeType = 'application/json'): void {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // 交给下一轮事件循环再释放，避免部分浏览器取消下载
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * 读取用户选择的文件为文本
 */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('读取文件失败'));

    reader.readAsText(file);
  });
}
