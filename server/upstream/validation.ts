import { isIP } from 'node:net';
import type { ServerConfig } from '../config';
import { HttpError } from '../errors';

export function allowsPrivateUpstreams(config: ServerConfig): boolean {
  if (process.env.ALLOW_PRIVATE_UPSTREAMS !== undefined) {
    return process.env.ALLOW_PRIVATE_UPSTREAMS === 'true';
  }

  return config.host === '127.0.0.1' || config.host === 'localhost' || config.host === '::1';
}

function normalizeHostnameForPrivateCheck(hostname: string): string {
  const lower = hostname.toLowerCase();
  const withoutBrackets = lower.startsWith('[') && lower.endsWith(']') ? lower.slice(1, -1) : lower;
  // FQDN 允许以点的形式书写（`localhost.` 与 `localhost` 等价），
  // 不去掉尾点会让 `http://localhost./` 绕过本机/内网校验。
  return withoutBrackets.endsWith('.') ? withoutBrackets.slice(0, -1) : withoutBrackets;
}

export function isPrivateHostname(hostname: string): boolean {
  const normalized = normalizeHostnameForPrivateCheck(hostname);
  if (normalized === 'localhost' || normalized.endsWith('.localhost')) {
    return true;
  }

  const ipVersion = isIP(normalized);
  if (ipVersion === 4) {
    const [a = 0, b = 0] = normalized.split('.').map(Number);
    return (
      a === 10 ||
      a === 127 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254) ||
      // 运营商级 NAT（100.64.0.0/10）：在内网侧同样不该被当作公网目标
      (a === 100 && b >= 64 && b <= 127) ||
      // 基准测试网段（198.18.0.0/15）
      (a === 198 && (b === 18 || b === 19)) ||
      // 240.0.0.0/4 保留段（含 255.255.255.255 广播）
      a >= 240 ||
      a === 0
    );
  }

  if (ipVersion === 6) {
    const ipv4MappedMatch = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (ipv4MappedMatch?.[1]) {
      return isPrivateHostname(ipv4MappedMatch[1]);
    }

    if (normalized.startsWith('::ffff:')) {
      return true;
    }

    // 未指定地址 / 回环
    if (normalized === '::1' || normalized === '::') return true;

    const firstHextet = normalized.split(':')[0] ?? '';
    // 唯一本地地址 fc00::/7
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
    // 链路本地 fe80::/10（fe80 – febf）
    if (['fe8', 'fe9', 'fea', 'feb'].some(prefix => firstHextet.startsWith(prefix))) return true;
    // 组播 ff00::/8
    if (firstHextet.startsWith('ff')) return true;

    return false;
  }

  return false;
}

export function validateUpstreamBaseUrl(rawBaseURL: string, config: ServerConfig): string {
  let url: URL;
  try {
    url = new URL(rawBaseURL);
  } catch {
    throw new HttpError(400, 'baseURL 无效');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new HttpError(400, 'baseURL 仅支持 http/https');
  }

  if (url.username || url.password) {
    throw new HttpError(400, 'baseURL 不允许包含认证信息');
  }

  if (!allowsPrivateUpstreams(config) && isPrivateHostname(url.hostname)) {
    throw new HttpError(400, 'baseURL 不允许指向本机或内网地址');
  }

  url.hash = '';
  url.search = '';
  return url.toString().replace(/\/$/, '');
}
