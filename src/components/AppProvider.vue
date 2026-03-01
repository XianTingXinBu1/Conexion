<script setup lang="ts">
import { onMounted, provide } from 'vue';
import { useTheme } from '@/composables/useTheme';
import { useCharacters } from '@/composables/useCharacters';
import { useDebugLogger } from '@/composables/useDebugLogger';
import { useAppSettings } from '@/composables/useAppSettings';
import { getStorage, setStorage, removeStorage } from '@/utils/storage';
import { STORAGE_KEYS, DEFAULT_PROMPT_PRESETS } from '@/constants';

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
  Object.values(STORAGE_KEYS).forEach((key) => {
    removeStorage(key);
  });
  location.reload();
};

/**
 * 初始化应用
 */
const initializeApp = async () => {
  initCharacters();

  // 初始化提示词预设（如果不存在）
  const existingPresets = await getStorage(STORAGE_KEYS.PROMPT_PRESETS, null);
  if (!existingPresets) {
    await setStorage(STORAGE_KEYS.PROMPT_PRESETS, DEFAULT_PROMPT_PRESETS);
  }

  // 初始化选中的提示词预设（如果不存在）
  const existingSelected = await getStorage(STORAGE_KEYS.SELECTED_PROMPT_PRESET, null);
  if (!existingSelected) {
    await setStorage(STORAGE_KEYS.SELECTED_PROMPT_PRESET, 'default');
  }
};

// 生命周期
onMounted(() => {
  initializeApp();
});

// 提供全局状态给子组件
provide('app-theme', { theme, toggleTheme });
provide('app-debug', { debugMode, toggleDebugMode });
provide('app-settings', appSettings);
provide('app-data', {
  selectedUser,
  deleteAllData,
});
</script>

<template>
  <slot />
</template>