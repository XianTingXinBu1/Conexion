import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import { ensureStorageSchema } from './utils/storageSchema';

async function bootstrap() {
  await ensureStorageSchema();

  const app = createApp(App);

  app.use(router);
  app.mount('#app');
}

void bootstrap();
