import { ref, watch, onMounted, nextTick } from 'vue';
import type { Theme } from '@/types';
import { SETTING_KEYS } from '../constants';
import { getSetting, setSetting } from '@/repositories/settingsRepository';

/**
 * 主题管理 Composable
 */
export function useTheme() {
  const theme = ref<Theme>('light');

  /**
   * 标记「这次赋值来自后端」。
   *
   * watch 在微任务里触发，而赋值后函数可能马上就结束了，
   * 所以显式等一次 nextTick：让这次远程赋值引起的 watch 回调先跑完（被跳过）再清除标志。
   */
  let applyingRemoteTheme = false;

  // 从存储加载主题
  const loadTheme = async () => {
    const savedTheme = await getSetting<string>(SETTING_KEYS.THEME, 'light');
    if (savedTheme === 'light' || savedTheme === 'dark') {
      applyingRemoteTheme = true;
      theme.value = savedTheme;
      await nextTick();
      applyingRemoteTheme = false;
    }
  };

  // 切换主题
  const toggleTheme = () => {
    theme.value = theme.value === 'light' ? 'dark' : 'light';
  };

  // 应用主题到 DOM
  const applyTheme = (newTheme: Theme) => {
    if (newTheme === 'dark') {
      document.body.setAttribute('data-theme', 'dark');
    } else {
      document.body.removeAttribute('data-theme');
    }
  };

  // 监听主题变化，应用到 DOM
  watch(theme, (newTheme) => {
    applyTheme(newTheme);
    // 读回来的主题不再回写：否则冷启动（或刷新）都会把后端已有的值原样 PUT 回去。
    if (applyingRemoteTheme) return;

    void setSetting(SETTING_KEYS.THEME, newTheme);
  });

  // 组件挂载时加载主题
  onMounted(() => {
    loadTheme();
    applyTheme(theme.value);
  });

  return {
    theme,
    toggleTheme,
  };
}