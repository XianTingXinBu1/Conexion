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
  const normalized = hostname.toLowerCase();
  return normalized.startsWith('[') && normalized.endsWith(']')
    ? normalized.slice(1, -1)
    : normalized;
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

    return normalized === '::1' || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe80:');
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
