<script setup lang="ts">
import { onMounted, provide } from 'vue';
import { useTheme } from '@/composables/useTheme';
import { useCharacters } from '@/composables/useCharacters';
import { useDebugLogger } from '@/composables/useDebugLogger';
import { useAppSettings } from '@/composables/useAppSettings';
import { clearStorage } from '@/utils/storage';
import { ensureStorageSchema } from '@/utils/storageSchema';

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
  await ensureStorageSchema();
  await initCharacters();
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
