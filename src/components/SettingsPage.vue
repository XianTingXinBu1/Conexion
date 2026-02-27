<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ArrowLeft } from 'lucide-vue-next';
import type { Theme } from '../types';
import type { MergeMode } from '../modules/system-prompt';
import { STORAGE_KEYS } from '../constants';
import { useNotifications, getNotificationMessage } from '../modules/notification';
import { getStorage } from '@/utils/storage';
import ChatSettingsSection from './settings/ChatSettingsSection.vue';
import DataManagementSection from './settings/DataManagementSection.vue';

interface Props {
  theme: Theme;
  enterToSend: boolean;
  showWordCount: boolean;
  enableMarkdown: boolean;
  showMessageIndex: boolean;
  chatHistoryLimit: number;
  debugMode: boolean;
  promptMergeMode: MergeMode;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  back: [];
  toggleTheme: [];
  updateEnterToSend: [value: boolean];
  updateShowWordCount: [value: boolean];
  updateEnableMarkdown: [value: boolean];
  updateShowMessageIndex: [value: boolean];
  updateChatHistoryLimit: [value: number];
  updatePromptMergeMode: [value: MergeMode];
  deleteAllData: [];
  restoreDefaults: [];
  toggleDebugMode: [];
}>();

// 使用通知 composable
const { showSuccess, showWarning } = useNotifications();

// 计算数据占用大小
const dataSize = ref(0);

const calculateDataSize = async () => {
  let totalSize = 0;
  for (const key of Object.values(STORAGE_KEYS)) {
    const value = await getStorage<string>(key, '');
    if (value) {
      const encoder = new TextEncoder();
      const encoded = encoder.encode(value);
      totalSize += encoded.length;
    }
  }
  dataSize.value = totalSize;
};

const handleDeleteAllData = () => {
  emit('deleteAllData');
  const msg = getNotificationMessage('SETTINGS_DATA_DELETE_SUCCESS');
  showWarning(msg.title, msg.message);
};

const handleRestoreDefaults = () => {
  emit('restoreDefaults');
  const msg = getNotificationMessage('SETTINGS_RESTORE_SUCCESS');
  showSuccess(msg.title, msg.message);
};

// 组件挂载时计算数据大小
onMounted(async () => {
  await calculateDataSize();
});
</script>

<template>
  <div class="settings-page">
    <!-- 顶部导航栏 -->
    <header class="page-header">
      <button class="nav-btn" @click="emit('back')">
        <ArrowLeft :size="22" />
      </button>
      <div class="header-content">
        <div class="page-title">设置</div>
        <div class="page-subtitle">Settings</div>
      </div>
      <div class="nav-btn"></div>
    </header>

    <!-- 滚动内容区域 -->
    <div class="content-scroll">
      <!-- 聊天设置 -->
      <ChatSettingsSection
        :enter-to-send="enterToSend"
        :show-word-count="showWordCount"
        :enable-markdown="enableMarkdown"
        :show-message-index="showMessageIndex"
        :debug-mode="debugMode"
        :chat-history-limit="chatHistoryLimit"
        :prompt-merge-mode="promptMergeMode"
        @update-enter-to-send="emit('updateEnterToSend', $event)"
        @update-show-word-count="emit('updateShowWordCount', $event)"
        @update-enable-markdown="emit('updateEnableMarkdown', $event)"
        @update-show-message-index="emit('updateShowMessageIndex', $event)"
        @update-chat-history-limit="emit('updateChatHistoryLimit', $event)"
        @update-prompt-merge-mode="emit('updatePromptMergeMode', $event)"
        @toggle-debug-mode="emit('toggleDebugMode')"
      />

      <!-- 数据管理 -->
      <DataManagementSection
        :data-size="dataSize"
        @delete-all-data="handleDeleteAllData"
        @restore-defaults="handleRestoreDefaults"
      />
    </div>
  </div>
</template>

<style scoped>
.settings-page {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
  overflow: hidden;
}

/* 顶部导航栏 */
.page-header {
  padding: 20px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.nav-btn {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  border: none;
  background: transparent;
  color: var(--text-main);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  flex-shrink: 0;
}

.nav-btn:active {
  transform: scale(0.9);
  background: var(--accent-soft);
}

.header-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.page-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-main);
  letter-spacing: -0.3px;
}

.page-subtitle {
  font-size: 11px;
  color: var(--text-muted);
  font-weight: 500;
}

/* 内容滚动区域 */
.content-scroll {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 14px 16px;
}

/* 滚动条样式 */
.content-scroll::-webkit-scrollbar {
  width: 4px;
}

.content-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.content-scroll::-webkit-scrollbar-thumb {
  background: var(--accent-soft);
  border-radius: 2px;
}
</style>