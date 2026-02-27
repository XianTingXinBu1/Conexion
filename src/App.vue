<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import MainPage from './components/MainPage.vue';
import ChatPage from './components/ChatPage.vue';
import ApiPresetPage from './components/ApiPresetPage.vue';
import SettingsPage from './components/SettingsPage.vue';
import ConversationListPage from './components/ConversationListPage.vue';
import RegexScriptPage from './components/RegexScriptPage.vue';
import RoleManagementPage from './components/RoleManagementPage.vue';
import PromptPresetPage from './components/PromptPresetPage.vue';
import KnowledgeBasePage from './components/KnowledgeBasePage.vue';
import ConfirmDialog from './components/ConfirmDialog.vue';
import { useTheme } from './composables/useTheme';
import { useLocalStorage } from './composables/useLocalStorage';
import { useCharacters } from './composables/useCharacters';
import { useDebugLogger } from './composables/useDebugLogger';
import { useNavigation } from './composables/useNavigation';
import { useHistoryInterception } from './composables/useHistoryInterception';
import { NotificationContainer } from './modules/notification';
import { getStorage, setStorage, removeStorage } from '@/utils/storage';
import { STORAGE_KEYS, DEFAULTS, DEFAULT_PROMPT_PRESETS } from './constants';
import type { Conversation } from './types';
import type { MergeMode } from './modules/system-prompt';

const { theme, toggleTheme } = useTheme();
const { selectedUser, init: initCharacters } = useCharacters();
const { debugMode, showDebugHelp } = useDebugLogger();

// 使用导航管理 composable
const {
  currentPage,
  transitionName,
  pageHistory,
  currentCharacter,
  currentConversationId,
  navigateToChat,
  navigateToChatWithCharacter,
  navigateToConversation,
  navigateToApiPreset,
  navigateToSettings,
  navigateToConversationList,
  navigateToRegexScript,
  navigateToRoleManagement,
  navigateToPromptPreset,
  navigateToKnowledgeBase,
  navigateBack,
  navigateToMain,
} = useNavigation();

// 使用历史拦截 composable
const { showExitConfirm, setupHistoryInterception, cleanupHistoryInterception, confirmExit, cancelExit } = useHistoryInterception(
  navigateBack,
  () => currentPage.value,
  pageHistory,
  { value: false } // isNavigating 由 useNavigation 内部管理
);

// 设置相关的本地存储
const { value: enterToSend } = useLocalStorage(STORAGE_KEYS.ENTER_TO_SEND, true);
const { value: showWordCount } = useLocalStorage(STORAGE_KEYS.SHOW_WORD_COUNT, false);
const { value: enableMarkdown } = useLocalStorage(STORAGE_KEYS.ENABLE_MARKDOWN, true);
const { value: showMessageIndex } = useLocalStorage(STORAGE_KEYS.SHOW_MESSAGE_INDEX, false);
const { value: chatHistoryLimit } = useLocalStorage(STORAGE_KEYS.CHAT_HISTORY_LIMIT, 20);
const { value: promptMergeMode } = useLocalStorage<MergeMode>(STORAGE_KEYS.PROMPT_MERGE_MODE, DEFAULTS.PROMPT_MERGE_MODE);

// 设置更新方法
const updateEnterToSend = (value: boolean) => { enterToSend.value = value; };
const updateShowWordCount = (value: boolean) => { showWordCount.value = value; };
const updateEnableMarkdown = (value: boolean) => { enableMarkdown.value = value; };
const updateShowMessageIndex = (value: boolean) => { showMessageIndex.value = value; };
const updateChatHistoryLimit = (value: number) => { chatHistoryLimit.value = value; };
const updatePromptMergeMode = (value: MergeMode) => { promptMergeMode.value = value; };

// 切换调试模式
const toggleDebugMode = () => {
  debugMode.value = !debugMode.value;
  if (debugMode.value) {
    showDebugHelp();
  }
};

// 会话更新处理
const handleUpdateConversation = (_conversation: Conversation) => {
  // 会话更新由 ChatPage 内部处理，这里可以添加额外的逻辑
  // 例如：更新会话列表的显示等
};

// 删除所有数据
const deleteAllData = async () => {
  Object.values(STORAGE_KEYS).forEach((key) => {
    removeStorage(key);
  });
  location.reload();
};

// 恢复默认设置
const restoreDefaults = async () => {
  await setStorage(STORAGE_KEYS.ENTER_TO_SEND, true);
  await setStorage(STORAGE_KEYS.SHOW_WORD_COUNT, false);
  await setStorage(STORAGE_KEYS.ENABLE_MARKDOWN, true);
  await setStorage(STORAGE_KEYS.SHOW_MESSAGE_INDEX, DEFAULTS.SHOW_MESSAGE_INDEX);
  await setStorage(STORAGE_KEYS.CHAT_HISTORY_LIMIT, DEFAULTS.CHAT_HISTORY_LIMIT);
  await setStorage(STORAGE_KEYS.MERGE_PROMPT_PRESETS, DEFAULTS.MERGE_PROMPT_PRESETS);
  await setStorage(STORAGE_KEYS.PROMPT_MERGE_MODE, DEFAULTS.PROMPT_MERGE_MODE);
  await setStorage(STORAGE_KEYS.DEBUG_MODE, DEFAULTS.DEBUG_MODE);
  location.reload();
};

// 生命周期钩子
onMounted(async () => {
  setupHistoryInterception();
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
});

onUnmounted(() => {
  cleanupHistoryInterception();
});
</script>

<template>
  <div class="app">
    <Transition :name="transitionName" mode="out-in">
      <MainPage
        v-if="currentPage === 'main'"
        key="main"
        :theme="theme"
        @toggle-theme="toggleTheme"
        @navigate-conversation-list="navigateToConversationList"
        @navigate-api-preset="navigateToApiPreset"
        @navigate-settings="navigateToSettings"
        @navigate-regex-script="navigateToRegexScript"
        @navigate-role-management="navigateToRoleManagement"
        @navigate-prompt-preset="navigateToPromptPreset"
        @navigate-knowledge-base="navigateToKnowledgeBase"
      />
      <ConversationListPage
        v-else-if="currentPage === 'conversation-list'"
        key="conversation-list"
        :theme="theme"
        @back="navigateToMain"
        @toggle-theme="toggleTheme"
        @navigate-chat="() => navigateToChat('conversation-list')"
        @navigate-chat-with-character="navigateToChatWithCharacter"
        @navigate-to-conversation="navigateToConversation"
      />
      <ChatPage
        v-else-if="currentPage === 'chat'"
        key="chat"
        :theme="theme"
        :enter-to-send="enterToSend"
        :show-word-count="showWordCount"
        :enable-markdown="enableMarkdown"
        :show-message-index="showMessageIndex"
        :chat-history-limit="chatHistoryLimit"
        :prompt-merge-mode="promptMergeMode"
        :character="currentCharacter"
        :conversation-id="currentConversationId"
        :user-character="selectedUser"
        @back="navigateBack"
        @toggle-theme="toggleTheme"
        @update-conversation="handleUpdateConversation"
      />
      <ApiPresetPage
        v-else-if="currentPage === 'api-preset'"
        key="api-preset"
        :theme="theme"
        @back="navigateToMain"
        @toggle-theme="toggleTheme"
      />
      <SettingsPage
        v-else-if="currentPage === 'settings'"
        key="settings"
        :theme="theme"
        :enter-to-send="enterToSend"
        :show-word-count="showWordCount"
        :enable-markdown="enableMarkdown"
        :show-message-index="showMessageIndex"
        :chat-history-limit="chatHistoryLimit"
        :debug-mode="debugMode"
        :prompt-merge-mode="promptMergeMode"
        @back="navigateToMain"
        @toggle-theme="toggleTheme"
        @update-enter-to-send="updateEnterToSend"
        @update-show-word-count="updateShowWordCount"
        @update-enable-markdown="updateEnableMarkdown"
        @update-show-message-index="updateShowMessageIndex"
        @update-chat-history-limit="updateChatHistoryLimit"
        @update-prompt-merge-mode="updatePromptMergeMode"
        @toggle-debug-mode="toggleDebugMode"
        @delete-all-data="deleteAllData"
        @restore-defaults="restoreDefaults"
      />
      <RegexScriptPage
        v-else-if="currentPage === 'regex-script'"
        key="regex-script"
        :theme="theme"
        @back="navigateToMain"
        @toggle-theme="toggleTheme"
      />
      <RoleManagementPage
        v-else-if="currentPage === 'role-management'"
        key="role-management"
        :theme="theme"
        @back="navigateToMain"
        @toggle-theme="toggleTheme"
      />
      <PromptPresetPage
        v-else-if="currentPage === 'prompt-preset'"
        key="prompt-preset"
        :theme="theme"
        @back="navigateToMain"
      />
      <KnowledgeBasePage
        v-else-if="currentPage === 'knowledge-base'"
        key="knowledge-base"
        :theme="theme"
        @back="navigateToMain"
      />
    </Transition>

    <!-- 退出确认对话框 -->
    <ConfirmDialog
      :show="showExitConfirm"
      title="退出应用"
      message="确定要退出应用吗？"
      type="warning"
      confirm-text="退出"
      cancel-text="取消"
      @confirm="confirmExit"
      @cancel="cancelExit"
    />

    <!-- 通知容器 -->
    <NotificationContainer />
  </div>
</template>

<style>
:root {
  --bg-primary: #F8F7FF;
  --bg-secondary: #FFFFFF;
  --accent-purple: #9D8DF1;
  --accent-soft: #E0DAFF;
  --text-main: #2D2D44;
  --text-muted: #8E8E93;
  --border-color: rgba(157, 141, 241, 0.1);
  --shadow: 0 8px 30px rgba(157, 141, 241, 0.08);
  --transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

[data-theme='dark'] {
  --bg-primary: #12121A;
  --bg-secondary: #1C1C26;
  --accent-purple: #B7A3E3;
  --accent-soft: #2D2D44;
  --text-main: #E6E6FA;
  --text-muted: #A0A0B8;
  --border-color: rgba(183, 163, 227, 0.1);
  --shadow: 0 8px 40px rgba(0, 0, 0, 0.3);
}

* {
  box-sizing: border-box;
  -webkit-tap-highlight-color: transparent;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
}

body {
  margin: 0;
  padding: 0;
  background-color: var(--bg-primary);
  color: var(--text-main);
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  transition: background-color var(--transition);
}

#app {
  width: 100%;
  height: 100%;
  display: flex;
  overflow: hidden;
}

.app {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
}

/* 页面过渡动画 - 淡入淡出效果 */
.slide-forward-enter-active,
.slide-forward-leave-active,
.slide-back-enter-active,
.slide-back-leave-active {
  transition: opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1);
}

.slide-forward-enter-from,
.slide-back-enter-from {
  opacity: 0;
}

.slide-forward-leave-to,
.slide-back-leave-to {
  opacity: 0;
}
</style>