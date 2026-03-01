<script setup lang="ts">
import { ref, onMounted, inject } from 'vue';
import { useRouter } from 'vue-router';
import { ArrowLeft } from 'lucide-vue-next';
import type { MergeMode } from '../modules/system-prompt';
import { STORAGE_KEYS } from '../constants';
import { useNotifications, getNotificationMessage } from '../modules/notification';
import { getStorage, setStorage } from '@/utils/storage';
import ChatSettingsSection from './settings/ChatSettingsSection.vue';
import DataManagementSection from './settings/DataManagementSection.vue';

const router = useRouter();

// 从 AppProvider 注入的应用状态
const appSettings = inject('app-settings') as Record<string, any> | undefined;
const appDebug = inject('app-debug') as { debugMode: { value: boolean }; toggleDebugMode: () => void } | undefined;

// 设置值
const enterToSend = ref(appSettings?.enterToSend?.value ?? true);
const showWordCount = ref(appSettings?.showWordCount?.value ?? false);
const enableMarkdown = ref(appSettings?.enableMarkdown?.value ?? true);
const showMessageIndex = ref(appSettings?.showMessageIndex?.value ?? false);
const chatHistoryLimit = ref(appSettings?.chatHistoryLimit?.value ?? 50);
const debugMode = ref(appDebug?.debugMode?.value ?? false);
const promptMergeMode = ref<MergeMode>('adjacent');

// 从存储加载设置
const loadSettings = async () => {
  enterToSend.value = await getStorage(STORAGE_KEYS.ENTER_TO_SEND, true);
  showWordCount.value = await getStorage(STORAGE_KEYS.SHOW_WORD_COUNT, false);
  enableMarkdown.value = await getStorage(STORAGE_KEYS.ENABLE_MARKDOWN, true);
  showMessageIndex.value = await getStorage(STORAGE_KEYS.SHOW_MESSAGE_INDEX, false);
  chatHistoryLimit.value = await getStorage(STORAGE_KEYS.CHAT_HISTORY_LIMIT, 50);
  debugMode.value = await getStorage(STORAGE_KEYS.DEBUG_MODE, false);
  promptMergeMode.value = await getStorage(STORAGE_KEYS.PROMPT_MERGE_MODE, 'adjacent');
};

// 更新设置
const updateEnterToSend = async (value: boolean) => {
  enterToSend.value = value;
  await setStorage(STORAGE_KEYS.ENTER_TO_SEND, value);
};

const updateShowWordCount = async (value: boolean) => {
  showWordCount.value = value;
  await setStorage(STORAGE_KEYS.SHOW_WORD_COUNT, value);
};

const updateEnableMarkdown = async (value: boolean) => {
  enableMarkdown.value = value;
  await setStorage(STORAGE_KEYS.ENABLE_MARKDOWN, value);
};

const updateShowMessageIndex = async (value: boolean) => {
  showMessageIndex.value = value;
  await setStorage(STORAGE_KEYS.SHOW_MESSAGE_INDEX, value);
};

const updateChatHistoryLimit = async (value: number) => {
  chatHistoryLimit.value = value;
  await setStorage(STORAGE_KEYS.CHAT_HISTORY_LIMIT, value);
};

const updatePromptMergeMode = async (value: MergeMode) => {
  promptMergeMode.value = value;
  await setStorage(STORAGE_KEYS.PROMPT_MERGE_MODE, value);
};

const toggleDebugMode = () => {
  debugMode.value = !debugMode.value;
  appDebug?.toggleDebugMode();
};

// 使用通知 composable
const { showSuccess } = useNotifications();

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

const handleDeleteAllData = async () => {
  Object.values(STORAGE_KEYS).forEach(async (key) => {
    await setStorage(key, null);
  });
  location.reload();
};

const handleRestoreDefaults = async () => {
  // 恢复默认设置
  await setStorage(STORAGE_KEYS.ENTER_TO_SEND, true);
  await setStorage(STORAGE_KEYS.SHOW_WORD_COUNT, false);
  await setStorage(STORAGE_KEYS.ENABLE_MARKDOWN, true);
  await setStorage(STORAGE_KEYS.SHOW_MESSAGE_INDEX, false);
  await setStorage(STORAGE_KEYS.CHAT_HISTORY_LIMIT, 50);
  await setStorage(STORAGE_KEYS.DEBUG_MODE, false);
  await setStorage(STORAGE_KEYS.PROMPT_MERGE_MODE, 'adjacent');
  await loadSettings();
  const msg = getNotificationMessage('SETTINGS_RESTORE_SUCCESS');
  showSuccess(msg.title, msg.message);
};

// 组件挂载时计算数据大小和加载设置
onMounted(async () => {
  await calculateDataSize();
  await loadSettings();
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
        @update-enter-to-send="updateEnterToSend"
        @update-show-word-count="updateShowWordCount"
        @update-enable-markdown="updateEnableMarkdown"
        @update-show-message-index="updateShowMessageIndex"
        @update-chat-history-limit="updateChatHistoryLimit"
        @update-prompt-merge-mode="updatePromptMergeMode"
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