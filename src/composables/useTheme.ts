import { ref, watch, onMounted } from 'vue';
import type { Theme } from '../types';
import { STORAGE_KEYS } from '../constants';
import { getStorage, setStorage } from '@/utils/storage';

/**
 * 主题管理 Composable
 */
export function useTheme() {
  const theme = ref<Theme>('light');

  // 从存储加载主题
  const loadTheme = async () => {
    const savedTheme = await getStorage<string>(STORAGE_KEYS.THEME, 'light');
    if (savedTheme === 'light' || savedTheme === 'dark') {
      theme.value = savedTheme;
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
    setStorage(STORAGE_KEYS.THEME, newTheme);
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