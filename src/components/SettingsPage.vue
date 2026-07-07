<script setup lang="ts">
import { ref, onMounted, inject } from 'vue';
import { useRouter } from 'vue-router';
import { ArrowLeft } from 'lucide-vue-next';
import { useNotifications, getNotificationMessage } from '../modules/notification';
import { clearBackendData, getAllSettings } from '@/repositories/settingsRepository';
import { useAppSettings, APP_SETTINGS_DEFAULTS, writeAppSettingsDefaults } from '../composables/useAppSettings';
import { APP_DEBUG_KEY, APP_SETTINGS_KEY } from '@/app/providers/appInjectionKeys';
import ChatSettingsSection from './settings/ChatSettingsSection.vue';
import DataManagementSection from './settings/DataManagementSection.vue';

const router = useRouter();

const injectedAppSettings = inject(APP_SETTINGS_KEY);
const appSettings = injectedAppSettings ?? useAppSettings();
const appDebug = inject(APP_DEBUG_KEY);

const {
  enterToSend,
  showWordCount,
  enableMarkdown,
  showMessageIndex,
  chatHistoryLimit,
  promptMergeMode,
  compressionThresholdPercent,
  compressionMode,
  updateEnterToSend,
  updateShowWordCount,
  updateEnableMarkdown,
  updateShowMessageIndex,
  updateChatHistoryLimit,
  updatePromptMergeMode,
  updateCompressionThresholdPercent,
  updateCompressionMode,
} = appSettings;

const debugMode = appDebug?.debugMode ?? ref(false);

const toggleDebugMode = () => {
  appDebug?.toggleDebugMode();
};

// 使用通知 composable
const { showSuccess } = useNotifications();

// 计算数据占用大小
const dataSize = ref(0);

const calculateDataSize = async () => {
  const settings = await getAllSettings();
  dataSize.value = new TextEncoder().encode(JSON.stringify(settings)).length;
};

const handleDeleteAllData = async () => {
  await clearBackendData();
  location.reload();
};

const handleRestoreDefaults = async () => {
  await writeAppSettingsDefaults();
  updateEnterToSend(APP_SETTINGS_DEFAULTS.enterToSend);
  updateShowWordCount(APP_SETTINGS_DEFAULTS.showWordCount);
  updateEnableMarkdown(APP_SETTINGS_DEFAULTS.enableMarkdown);
  updateShowMessageIndex(APP_SETTINGS_DEFAULTS.showMessageIndex);
  updateChatHistoryLimit(APP_SETTINGS_DEFAULTS.chatHistoryLimit);
  updatePromptMergeMode(APP_SETTINGS_DEFAULTS.promptMergeMode);
  updateCompressionThresholdPercent(APP_SETTINGS_DEFAULTS.compressionThresholdPercent);
  updateCompressionMode(APP_SETTINGS_DEFAULTS.compressionMode);
  debugMode.value = false;
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
      <button class="nav-btn" @click="router.back()">
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
        :compression-threshold-percent="compressionThresholdPercent"
        :compression-mode="compressionMode"
        @update-enter-to-send="updateEnterToSend"
        @update-show-word-count="updateShowWordCount"
        @update-enable-markdown="updateEnableMarkdown"
        @update-show-message-index="updateShowMessageIndex"
        @update-chat-history-limit="updateChatHistoryLimit"
        @update-prompt-merge-mode="updatePromptMergeMode"
        @update-compression-threshold-percent="updateCompressionThresholdPercent"
        @update-compression-mode="updateCompressionMode"
        @toggle-debug-mode="toggleDebugMode"
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
