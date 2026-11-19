import { onMounted, ref, watch, nextTick } from 'vue';
import type { Theme } from '@/types';
import { SETTING_KEYS } from '../constants';
import { getSetting, setSetting } from '@/repositories/settingsRepository';

/**
 * 主题管理 Composable
 *
 * 状态是**模块级单例**：AppProvider 与聊天页都会调用 useTheme()，
 * 以前每次调用都新建一份 ref + watcher + loadTheme，导致
 * 1) 一处 toggle 之后另一处的 theme 还是旧值，界面与主题不同步；
 * 2) 两份 watcher 对同一个 setting key 各写一次，冷启动/切换时重复 PUT 甚至互相覆盖。
 *
 * 现在主题 ref、watch 只在模块作用域存在一份，组件内只做读取与调用 toggleTheme。
 */
const theme = ref<Theme>('light');

/**
 * 标记「这次赋值来自后端」。
 *
 * watch 在微任务里触发，而赋值后函数可能马上就结束了，
 * 所以显式等一次 nextTick：让这次远程赋值引起的 watch 回调先跑完（被跳过）再清除标志。
 */
let applyingRemoteTheme = false;

// 应用主题到 DOM
const applyTheme = (newTheme: Theme) => {
  if (newTheme === 'dark') {
    document.body.setAttribute('data-theme', 'dark');
  } else {
    document.body.removeAttribute('data-theme');
  }
};

// 从存储加载主题
const loadTheme = async () => {
  try {
    const savedTheme = await getSetting<string>(SETTING_KEYS.THEME, 'light');
    if (savedTheme !== 'light' && savedTheme !== 'dark') {
      return;
    }

    applyingRemoteTheme = true;
    try {
      theme.value = savedTheme;
      await nextTick();
    } finally {
      // 赋值或 nextTick 抛错也不能让标记永久为 true，否则之后所有切换都不再保存
      applyingRemoteTheme = false;
    }
  } catch (error) {
    // onMounted 里是 fire-and-forget 调用：不捕获就是未处理的 rejection，
    // 而且主题会静默停在默认值
    console.warn('[useTheme] 加载主题失败，保持当前主题:', error);
  }
};

// 切换主题
const toggleTheme = () => {
  theme.value = theme.value === 'light' ? 'dark' : 'light';
};

// 监听主题变化，应用到 DOM
watch(theme, (newTheme) => {
  applyTheme(newTheme);
  // 读回来的主题不再回写：否则冷启动（或刷新）都会把后端已有的值原样 PUT 回去。
  if (applyingRemoteTheme) return;

  void setSetting(SETTING_KEYS.THEME, newTheme);
});

export function useTheme() {
  onMounted(() => {
    void loadTheme();
    applyTheme(theme.value);
  });

  return {
    theme,
    toggleTheme,
  };
}
