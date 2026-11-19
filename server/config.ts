export interface ServerConfig {
  host: string;
  port: number;
  clientOrigin: string;
  defaultUpstreamBaseUrl: string;
  defaultUpstreamApiKey: string;
  upstreamTimeoutMs: number;
  maxBodyBytes: number;
  dataDir: string;
}

/**
 * 读一个整数环境变量。
 *
 * `Number('abc')` 静默得到 NaN 并一路往下游扩散：port 变 NaN 会监听失败，
 * `receivedBytes > NaN` 恒为 false 会让请求体大小限制直接失效，
 * 所以这里统一做解析 + 范围校验，非法值立刻报错而不是带着 NaN 继续跑。
 */
function readIntegerEnv(
  name: string,
  fallback: number,
  { min, max }: { min: number; max: number },
): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') {
    return fallback;
  }

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`环境变量 ${name} 必须是 ${min}-${max} 之间的整数，当前为「${raw}」`);
  }

  return parsed;
}

export function getServerConfig(): ServerConfig {
  return {
    host: process.env.HOST || '127.0.0.1',
    port: readIntegerEnv('PORT', 3900, { min: 0, max: 65535 }),
    clientOrigin: process.env.CLIENT_ORIGIN || 'http://127.0.0.1:3100',
    defaultUpstreamBaseUrl: process.env.DEFAULT_UPSTREAM_BASE_URL || '',
    defaultUpstreamApiKey: process.env.DEFAULT_UPSTREAM_API_KEY || '',
    upstreamTimeoutMs: readIntegerEnv('UPSTREAM_TIMEOUT_MS', 60000, { min: 1, max: 2_147_483_647 }),
    maxBodyBytes: readIntegerEnv('MAX_BODY_BYTES', 1024 * 1024, { min: 1, max: 2_147_483_647 }),
    dataDir: process.env.CONEXION_DATA_DIR || '.runtime/data',
  };
}
