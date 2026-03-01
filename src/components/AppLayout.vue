<script setup lang="ts">
import { inject } from 'vue';
import type { Theme, Conversation, AICharacter, UserCharacter } from '@/types';
import type { MergeMode } from '@/modules/system-prompt';
import MainPage from './MainPage.vue';
import ChatPage from './ChatPage.vue';
import ApiPresetPage from './ApiPresetPage.vue';
import SettingsPage from './SettingsPage.vue';
import ConversationListPage from './ConversationListPage.vue';
import RegexScriptPage from './RegexScriptPage.vue';
import RoleManagementPage from './RoleManagementPage.vue';
import PromptPresetPage from './PromptPresetPage.vue';
import KnowledgeBasePage from './KnowledgeBasePage.vue';
import ConfirmDialog from './ConfirmDialog.vue';
import { NotificationContainer } from '@/modules/notification';
import { useNavigation } from '@/composables/useNavigation';

// 从 inject 获取状态
const appTheme = inject('app-theme') as { theme: Theme; toggleTheme: () => void };
const appNavigation = inject('app-navigation') as {
  currentPage: string;
  transitionName: string;
  currentCharacter?: AICharacter;
  currentConversationId?: string;
  navigateBack: () => void;
};
const appDebug = inject('app-debug') as { debugMode: boolean; toggleDebugMode: () => void };
const appSettings = inject('app-settings') as {
  enterToSend: boolean;
  showWordCount: boolean;
  enableMarkdown: boolean;
  showMessageIndex: boolean;
  chatHistoryLimit: number;
  promptMergeMode: MergeMode;
  updateEnterToSend: (value: boolean) => void;
  updateShowWordCount: (value: boolean) => void;
  updateEnableMarkdown: (value: boolean) => void;
  updateShowMessageIndex: (value: boolean) => void;
  updateChatHistoryLimit: (value: number) => void;
  updatePromptMergeMode: (value: MergeMode) => void;
  restoreDefaults: () => Promise<void>;
};
const appData = inject('app-data') as {
  selectedUser?: UserCharacter;
  deleteAllData: () => Promise<void>;
  showExitConfirm: boolean;
  confirmExit: () => void;
  cancelExit: () => void;
};

// 使用导航 composable 获取导航方法
const {
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
  navigateToMain,
} = useNavigation();

/**
 * 会话更新处理
 */
const handleUpdateConversation = (_conversation: Conversation) => {
  // 会话更新由 ChatPage 内部处理
  // 未来可以在这里添加额外逻辑，例如更新会话列表的显示等
};
</script>

<template>
  <div class="app-layout">
    <Transition :name="appNavigation.transitionName" mode="out-in">
      <MainPage
        v-if="appNavigation.currentPage === 'main'"
        key="main"
        :theme="appTheme.theme"
        @toggle-theme="appTheme.toggleTheme"
        @navigate-conversation-list="navigateToConversationList"
        @navigate-api-preset="navigateToApiPreset"
        @navigate-settings="navigateToSettings"
        @navigate-regex-script="navigateToRegexScript"
        @navigate-role-management="navigateToRoleManagement"
        @navigate-prompt-preset="navigateToPromptPreset"
        @navigate-knowledge-base="navigateToKnowledgeBase"
      />
      <ConversationListPage
        v-else-if="appNavigation.currentPage === 'conversation-list'"
        key="conversation-list"
        :theme="appTheme.theme"
        @back="navigateToMain"
        @toggle-theme="appTheme.toggleTheme"
        @navigate-chat="navigateToChat"
        @navigate-chat-with-character="navigateToChatWithCharacter"
        @navigate-to-conversation="navigateToConversation"
      />
      <ChatPage
        v-else-if="appNavigation.currentPage === 'chat'"
        key="chat"
        :theme="appTheme.theme"
        :enter-to-send="appSettings.enterToSend"
        :show-word-count="appSettings.showWordCount"
        :enable-markdown="appSettings.enableMarkdown"
        :show-message-index="appSettings.showMessageIndex"
        :chat-history-limit="appSettings.chatHistoryLimit"
        :prompt-merge-mode="appSettings.promptMergeMode"
        :character="appNavigation.currentCharacter"
        :conversation-id="appNavigation.currentConversationId"
        :user-character="appData.selectedUser"
        @back="appNavigation.navigateBack"
        @toggle-theme="appTheme.toggleTheme"
        @update-conversation="handleUpdateConversation"
      />
      <ApiPresetPage
        v-else-if="appNavigation.currentPage === 'api-preset'"
        key="api-preset"
        :theme="appTheme.theme"
        @back="navigateToMain"
        @toggle-theme="appTheme.toggleTheme"
      />
      <SettingsPage
        v-else-if="appNavigation.currentPage === 'settings'"
        key="settings"
        :theme="appTheme.theme"
        :enter-to-send="appSettings.enterToSend"
        :show-word-count="appSettings.showWordCount"
        :enable-markdown="appSettings.enableMarkdown"
        :show-message-index="appSettings.showMessageIndex"
        :chat-history-limit="appSettings.chatHistoryLimit"
        :debug-mode="appDebug.debugMode"
        :prompt-merge-mode="appSettings.promptMergeMode"
        @back="navigateToMain"
        @toggle-theme="appTheme.toggleTheme"
        @update-enter-to-send="appSettings.updateEnterToSend"
        @update-show-word-count="appSettings.updateShowWordCount"
        @update-enable-markdown="appSettings.updateEnableMarkdown"
        @update-show-message-index="appSettings.updateShowMessageIndex"
        @update-chat-history-limit="appSettings.updateChatHistoryLimit"
        @update-prompt-merge-mode="appSettings.updatePromptMergeMode"
        @toggle-debug-mode="appDebug.toggleDebugMode"
        @delete-all-data="appData.deleteAllData"
        @restore-defaults="appSettings.restoreDefaults"
      />
      <RegexScriptPage
        v-else-if="appNavigation.currentPage === 'regex-script'"
        key="regex-script"
        :theme="appTheme.theme"
        @back="navigateToMain"
        @toggle-theme="appTheme.toggleTheme"
      />
      <RoleManagementPage
        v-else-if="appNavigation.currentPage === 'role-management'"
        key="role-management"
        :theme="appTheme.theme"
        @back="navigateToMain"
        @toggle-theme="appTheme.toggleTheme"
      />
      <PromptPresetPage
        v-else-if="appNavigation.currentPage === 'prompt-preset'"
        key="prompt-preset"
        :theme="appTheme.theme"
        @back="navigateToMain"
      />
      <KnowledgeBasePage
        v-else-if="appNavigation.currentPage === 'knowledge-base'"
        key="knowledge-base"
        :theme="appTheme.theme"
        @back="navigateToMain"
      />
    </Transition>

    <!-- 退出确认对话框 -->
    <ConfirmDialog
      :show="appData.showExitConfirm"
      title="退出应用"
      message="确定要退出应用吗？"
      type="warning"
      confirm-text="退出"
      cancel-text="取消"
      @confirm="appData.confirmExit"
      @cancel="appData.cancelExit"
    />

    <!-- 通知容器 -->
    <NotificationContainer />
  </div>
</template>

<style scoped>
.app-layout {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
}
</style>