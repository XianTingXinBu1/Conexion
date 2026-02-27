/**
 * URL 验证工具函数
 */

/**
 * 验证 URL 格式
 * @param url 要验证的 URL 字符串
 * @returns 验证结果 { valid: boolean, error?: string }
 */
export function validateUrl(url: string): { valid: boolean; error?: string } {
  if (!url || url.trim() === '') {
    return { valid: false, error: 'URL 不能为空' };
  }

  const trimmedUrl = url.trim();

  // 检查是否包含多个 https:// 或 http://
  const httpsMatches = (trimmedUrl.match(/https?:\/\//gi) || []).length;
  if (httpsMatches > 1) {
    return {
      valid: false,
      error: 'URL 格式错误：检测到多个协议头，请检查是否意外粘贴了多个 URL',
    };
  }

  // 检查 URL 是否包含有效的协议
  if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
    return { valid: false, error: 'URL 必须以 http:// 或 https:// 开头' };
  }

  try {
    const urlObj = new URL(trimmedUrl);

    // 验证协议
    if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
      return { valid: false, error: 'URL 协议必须为 http 或 https' };
    }

    // 验证主机名
    if (!urlObj.hostname) {
      return { valid: false, error: 'URL 必须包含有效的主机名' };
    }

    // 验证主机名格式
    if (!isValidHostname(urlObj.hostname)) {
      return { valid: false, error: '主机名格式无效' };
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: 'URL 格式无效，请检查输入',
    };
  }
}

/**
 * 验证主机名格式
 * @param hostname 主机名
 * @returns 是否有效
 */
function isValidHostname(hostname: string): boolean {
  // 基本的主机名验证
  const hostnameRegex = /^([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])(\.([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\-]{0,61}[a-zA-Z0-9]))*$/;
  return hostnameRegex.test(hostname);
}

/**
 * 清理 URL（移除末尾斜杠）
 * @param url 要清理的 URL
 * @returns 清理后的 URL
 */
export function normalizeUrl(url: string): string {
  return url.replace(/\/$/, '');
}

/**
 * 从错误消息中提取关键信息
 * @param error 错误消息
 * @returns 用户友好的错误描述
 */
export function getFriendlyErrorMessage(error: string): string {
  if (error.includes('1016') || error.includes('DNS error')) {
    return 'DNS 解析失败：请检查 URL 域名是否正确';
  }
  if (error.includes('530')) {
    return '服务端错误：可能是服务器暂时不可用';
  }
  if (error.includes('404')) {
    return '路径不存在：请检查 URL 路径是否正确';
  }
  if (error.includes('401') || error.includes('403')) {
    return '认证失败：请检查 API Key 是否正确';
  }
  if (error.includes('Failed to fetch')) {
    return '网络连接失败：请检查网络设置';
  }
  if (error.includes('timeout')) {
    return '请求超时：服务器响应时间过长';
  }
  return error;
}