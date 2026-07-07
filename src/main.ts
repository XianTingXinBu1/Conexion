import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import { ensureStorageSchema } from './utils/storageSchema';

function renderBootstrapError(error: unknown) {
  console.error('[bootstrap] 应用启动失败:', error);

  const root = document.querySelector('#app');
  if (!root) return;

  root.innerHTML = `
    <div style="padding: 24px; font-family: sans-serif; color: #ef4444;">
      <h1 style="font-size: 18px; margin: 0 0 8px;">Conexion 启动失败</h1>
      <p style="margin: 0; color: #666;">请刷新页面重试，或打开控制台查看错误信息。</p>
    </div>
  `;
}

async function bootstrap() {
  await ensureStorageSchema();

  const app = createApp(App);

  app.use(router);
  app.mount('#app');
}

void bootstrap().catch(renderBootstrapError);
