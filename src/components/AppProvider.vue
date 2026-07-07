<script setup lang="ts">
import { onMounted, provide } from 'vue';
import { useTheme } from '@/composables/useTheme';
import { useCharacters } from '@/composables/useCharacters';
import { useDebugLogger } from '@/composables/useDebugLogger';
import { useAppSettings } from '@/composables/useAppSettings';
import { clearStorage } from '@/utils/storage';
import {
  APP_DATA_KEY,
  APP_DEBUG_KEY,
  APP_SETTINGS_KEY,
  APP_THEME_KEY,
} from '@/app/providers/appInjectionKeys';

// 主题管理
const { theme, toggleTheme } = useTheme();

// 角色管理
const { selectedUser, init: initCharacters } = useCharacters();

// 调试日志
const { debugMode, showDebugHelp } = useDebugLogger();

// 应用设置
const { ...appSettings } = useAppSettings();

/**
 * 切换调试模式
 */
const toggleDebugMode = () => {
  debugMode.value = !debugMode.value;
  if (debugMode.value) {
    showDebugHelp();
  }
};

/**
 * 删除所有数据
 */
const deleteAllData = async () => {
  await clearStorage();
  location.reload();
};

/**
 * 初始化应用
 */
const initializeApp = async () => {
  try {
    await initCharacters();
  } catch (error) {
    console.error('[AppProvider] 初始化应用状态失败:', error);
  }
};

// 生命周期
onMounted(() => {
  void initializeApp();
});

// 提供全局状态给子组件
provide(APP_THEME_KEY, { theme, toggleTheme });
provide(APP_DEBUG_KEY, { debugMode, toggleDebugMode });
provide(APP_SETTINGS_KEY, appSettings);
provide(APP_DATA_KEY, {
  selectedUser,
  deleteAllData,
});
</script>

<template>
  <slot />
</template>
