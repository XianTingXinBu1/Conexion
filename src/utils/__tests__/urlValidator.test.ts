import { describe, expect, it } from 'vitest';
import { getFriendlyErrorMessage, normalizeUrl, validateUrl } from '../urlValidator';

describe('urlValidator', () => {
  it('accepts valid http and https URLs', () => {
    expect(validateUrl('https://example.com')).toEqual({ valid: true });
    expect(validateUrl('http://api.example.com/v1')).toEqual({ valid: true });
  });

  it('rejects empty URLs and missing protocols', () => {
    expect(validateUrl('')).toEqual({ valid: false, error: 'URL 不能为空' });
    expect(validateUrl('example.com')).toEqual({ valid: false, error: 'URL 必须以 http:// 或 https:// 开头' });
  });

  it('rejects duplicated protocol headers', () => {
    expect(validateUrl('https://https://example.com')).toEqual({
      valid: false,
      error: 'URL 格式错误：检测到多个协议头，请检查是否意外粘贴了多个 URL',
    });
  });

  it('rejects invalid hostnames', () => {
    expect(validateUrl('https://bad host.com')).toEqual({ valid: false, error: 'URL 格式无效，请检查输入' });
    expect(validateUrl('https://-bad-host.com')).toEqual({ valid: false, error: '主机名格式无效' });
  });

  it('normalizes trailing slashes only once', () => {
    expect(normalizeUrl('https://example.com/')).toBe('https://example.com');
    expect(normalizeUrl('https://example.com/api')).toBe('https://example.com/api');
  });

  it('maps common transport errors to friendly messages', () => {
    expect(getFriendlyErrorMessage('1016 DNS error')).toBe('DNS 解析失败：请检查 URL 域名是否正确');
    expect(getFriendlyErrorMessage('HTTP 404')).toBe('路径不存在：请检查 URL 路径是否正确');
    expect(getFriendlyErrorMessage('Request timeout')).toBe('请求超时：服务器响应时间过长');
    expect(getFriendlyErrorMessage('Unknown failure')).toBe('Unknown failure');
  });
});
