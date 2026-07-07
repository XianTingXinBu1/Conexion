import { createAdaptorServer } from '@hono/node-server';
import { fileURLToPath } from 'node:url';
import { createHonoApp } from './app';
import { getServerConfig } from './config';

export function createAppServer() {
  const config = getServerConfig();
  const app = createHonoApp(config);
  return createAdaptorServer({ fetch: app.fetch });
}

export function startServer() {
  const config = getServerConfig();
  const server = createAppServer();
  server.listen(config.port, config.host, () => {
    console.log(`[server] listening on http://${config.host}:${config.port}`);
  });
  return server;
}

const entryPath = process.argv[1] ? fileURLToPath(import.meta.url) === process.argv[1] : false;
if (entryPath) {
  startServer();
}
