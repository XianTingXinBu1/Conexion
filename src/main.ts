// 全局共享样式：所有页面组件（含懒加载页面）都依赖其中的公共类，
// 必须由入口引入，不能挂在某个懒加载页面上。
import './styles/common.css';
// KaTeX 官方样式（数学公式），同样是全局第三方样式
import 'katex/dist/katex.min.css';
import { createApp } from 'vue';
import App from './App.vue';
import router from './router';

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

function bootstrap() {
  const app = createApp(App);

  app.use(router);
  app.mount('#app');
}

try {
  bootstrap();
} catch (error) {
  renderBootstrapError(error);
}
