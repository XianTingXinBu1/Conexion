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

export function getServerConfig(): ServerConfig {
  return {
    host: process.env.HOST || '127.0.0.1',
    port: Number(process.env.PORT || 3900),
    clientOrigin: process.env.CLIENT_ORIGIN || 'http://127.0.0.1:3100',
    defaultUpstreamBaseUrl: process.env.DEFAULT_UPSTREAM_BASE_URL || '',
    defaultUpstreamApiKey: process.env.DEFAULT_UPSTREAM_API_KEY || '',
    upstreamTimeoutMs: Number(process.env.UPSTREAM_TIMEOUT_MS || 60000),
    maxBodyBytes: Number(process.env.MAX_BODY_BYTES || 1024 * 1024),
    dataDir: process.env.CONEXION_DATA_DIR || '.runtime/data',
  };
}
