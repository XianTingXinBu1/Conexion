/**
 * 上游 baseURL 的内网/本机校验
 *
 * 回归来源：`http://localhost./` 这类带 FQDN 尾点的写法既不等同 `localhost`、
 * 也不以 `.localhost` 结尾，会绕过内网校验（最终仍解析到 127.0.0.1）→ SSRF。
 */
import { describe, expect, it } from 'vitest';
import type { ServerConfig } from '../config';
import { isPrivateHostname, validateUpstreamBaseUrl } from './validation';

const publicConfig: ServerConfig = {
  host: '0.0.0.0',
} as ServerConfig;

const loopbackConfig: ServerConfig = {
  host: '127.0.0.1',
} as ServerConfig;

describe('isPrivateHostname', () => {
  it('识别本机与内网地址', () => {
    expect(isPrivateHostname('localhost')).toBe(true);
    expect(isPrivateHostname('127.0.0.1')).toBe(true);
    expect(isPrivateHostname('10.1.2.3')).toBe(true);
    expect(isPrivateHostname('172.16.0.1')).toBe(true);
    expect(isPrivateHostname('192.168.1.1')).toBe(true);
    expect(isPrivateHostname('169.254.1.1')).toBe(true);
    expect(isPrivateHostname('[::1]')).toBe(true);
    expect(isPrivateHostname('fd00::1')).toBe(true);
  });

  it('不把公网地址当内网', () => {
    expect(isPrivateHostname('example.com')).toBe(false);
    expect(isPrivateHostname('8.8.8.8')).toBe(false);
    expect(isPrivateHostname('172.32.0.1')).toBe(false);
  });

  it('带 FQDN 尾点的写法同样算本机', () => {
    // 回归：`localhost.` 以前两个判断都不命中
    expect(isPrivateHostname('localhost.')).toBe(true);
    expect(isPrivateHostname('evil.localhost.')).toBe(true);
    expect(isPrivateHostname('127.0.0.1.')).toBe(true);
  });
});

describe('validateUpstreamBaseUrl', () => {
  it('公网地址放行并去掉 query/hash 与尾斜杠', () => {
    expect(validateUpstreamBaseUrl('https://api.example.com/v1/?a=1#x', publicConfig)).toBe(
      'https://api.example.com/v1',
    );
  });

  it('拒绝指向本机的地址', () => {
    expect(() => validateUpstreamBaseUrl('http://127.0.0.1:8080', publicConfig)).toThrow();
    expect(() => validateUpstreamBaseUrl('http://localhost:8080', publicConfig)).toThrow();
    // 回归：带尾点的 FQDN 曾绕过校验
    expect(() => validateUpstreamBaseUrl('http://localhost.:8080', publicConfig)).toThrow();
    expect(() => validateUpstreamBaseUrl('http://evil.localhost./', publicConfig)).toThrow();
  });

  it('允许本机监听的实例访问内网上游', () => {
    expect(validateUpstreamBaseUrl('http://127.0.0.1:8080', loopbackConfig)).toBe(
      'http://127.0.0.1:8080',
    );
  });

  it('拒绝非 http/https 与带认证信息的地址', () => {
    expect(() => validateUpstreamBaseUrl('file:///etc/passwd', publicConfig)).toThrow();
    expect(() => validateUpstreamBaseUrl('https://user:pass@example.com', publicConfig)).toThrow();
  });
});
