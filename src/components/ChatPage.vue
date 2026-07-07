<script setup lang="ts">
import { defineAsyncComponent } from 'vue';
import { ArrowLeft } from 'lucide-vue-next';
import type { ChatPageProps } from '@/features/chat/presentation/chatPageTypes';
import { ChatInput, MessageItem, ContextRing } from './chat';
import { CompressionSummaryCard } from '@/modules/conversation-compression/components';
import { useChatPageViewModel } from '@/features/chat/presentation/useChatPageViewModel';

import '../styles/common.css';
import '../styles/chat.css';

const props = defineProps<ChatPageProps>();

const TokenDetailsPanel = defineAsyncComponent(() => import('./chat/TokenDetailsPanel.vue'));
const EditMessageModal = defineAsyncComponent(() => import('./chat/EditMessageModal.vue'));
const PromptPreviewModal = defineAsyncComponent(() => import('./chat/PromptPreviewModal.vue'));

const {
  router,
  enterToSend,
  showWordCount,
  enableMarkdown,
  showMessageIndex,
  compressionThresholdPercent,
  compressionMode,
  theme,
  chatTitle,
  chatSubtitle,
  compressionSummary,
  canUseConversationCompression,
  usagePercent,
  isCompressionThresholdReached,
  isCompressing,
  currentContextCount,
  maxContextLength,
  userTokens,
  aiTokens,
  chatMessageCount,
  userMessageCount,
  aiMessageCount,
  displayMessages,
  loadedCount,
  hasMoreMessages,
  loadMoreMessages,
  chatViewport,
  showTokenDetails,
  closeTokenDetails,
  toggleTokenDetails,
  handleCompressConversation,
  canCompress,
  currentApiPreset,
  usage,
  responseMetrics,
  isSending,
  isRequestActive,
  requestStatus,
  handleSendMessage,
  handleCancelSend,
  openPromptAssistant,
  showEditModal,
  editingMessageId,
  editingMessageContent,
  handleEditMessage,
  handleSaveEdit,
  showPromptPreview,
  lastSystemMessages,
  lastSystemPromptResult,
  handleDeleteMessage,
  ConfirmDialogComponent,
  confirmDialogProps,
  confirmDelete,
  cancelDelete,
  scrollPolicy,
} = useChatPageViewModel(props);
</script>

<template>
  <div class="chat-page">
    <header class="chat-header">
      <button class="nav-btn" @click="router.back()">
        <ArrowLeft :size="22" />
      </button>
      <div class="header-content">
        <div class="chat-title-row">
          <div class="chat-title">{{ chatTitle }}</div>
          <span v-if="compressionSummary" class="compression-badge">已压缩</span>
        </div>
        <div class="chat-subtitle">{{ chatSubtitle }}</div>
      </div>
      <ContextRing
        :current="currentContextCount"
        :max="maxContextLength"
        :theme="theme"
        :clickable="true"
        @click="toggleTokenDetails"
      />
    </header>

    <div
      v-if="canUseConversationCompression && isCompressionThresholdReached"
      class="compression-warning"
      :class="theme"
    >
      <div>
        上下文使用率已达到 {{ usagePercent }}%（阈值 {{ compressionThresholdPercent }}%）。
        <span v-if="compressionMode === 'auto'">正在自动压缩历史上下文。</span>
        <span v-else>可手动压缩会话以保留关键上下文。</span>
      </div>
    </div>

    <div
      v-if="compressionMode === 'manual' && canUseConversationCompression && canCompress"
      class="manual-compression-bar"
      :class="theme"
    >
      <span>可压缩历史上下文，压缩后会隐藏已摘要的旧消息。</span>
      <button
        class="compression-warning-btn"
        :disabled="isCompressing"
        @click="handleCompressConversation"
      >
        {{ isCompressing ? '压缩中...' : '手动压缩' }}
      </button>
    </div>

    <div :ref="(el) => { chatViewport.messagesContainer.value = el as HTMLElement | undefined; }" class="chat-messages">
      <CompressionSummaryCard
        v-if="compressionSummary"
        :summary="compressionSummary"
        :theme="theme"
      />
      <button
        v-if="hasMoreMessages"
        class="load-more-btn"
        @click="loadMoreMessages"
      >
        加载更多历史消息 ({{ chatMessageCount - loadedCount }} 条未加载)
      </button>
      <MessageItem
        v-for="(message, index) in displayMessages"
        :key="message.id"
        :message="message"
        :index="index"
        :total-messages="chatMessageCount"
        :display-count="displayMessages.length"
        :theme="theme"
        :enable-markdown="enableMarkdown"
        :show-word-count="showWordCount"
        :show-message-index="showMessageIndex"
        @edit="handleEditMessage"
        @delete="handleDeleteMessage"
      />
    </div>

    <!-- Token 使用详情侧栏 -->
    <TokenDetailsPanel
      v-if="showTokenDetails"
      :current-context-count="currentContextCount"
      :max-context-length="maxContextLength"
      :user-tokens="userTokens"
      :ai-tokens="aiTokens"
      :chat-message-count="chatMessageCount"
      :user-message-count="userMessageCount"
      :ai-message-count="aiMessageCount"
      :last-system-prompt-result="lastSystemPromptResult"
      :current-api-preset="currentApiPreset || null"
      :usage="usage"
      :response-metrics="responseMetrics"
      :theme="theme"
      :usage-percent="usagePercent"
      :compression-threshold-percent="compressionThresholdPercent"
      :compression-mode="compressionMode"
      :compression-summary="compressionSummary"
      :is-compression-threshold-reached="isCompressionThresholdReached"
      :is-compressing="isCompressing"
      :show-compression-section="canUseConversationCompression"
      :can-compress="canCompress && canUseConversationCompression"
      @close="closeTokenDetails"
      @compress="handleCompressConversation"
    />

    <ChatInput
      :enter-to-send="enterToSend"
      :is-sending="isSending"
      :is-request-active="isRequestActive"
      :request-status="requestStatus"
      @send="handleSendMessage"
      @cancel="handleCancelSend"
      @focus="scrollPolicy.onInputFocus"
      @show-prompt-assistant="openPromptAssistant"
    />

    <!-- 编辑消息模态框 -->
    <EditMessageModal
      :show="showEditModal"
      :message-id="editingMessageId"
      :content="editingMessageContent"
      @update:show="showEditModal = false"
      @save="handleSaveEdit"
    />

    <!-- 提示词预览模态框 -->
    <PromptPreviewModal
      :show="showPromptPreview"
      :system-messages="lastSystemMessages"
      :estimated-tokens="lastSystemPromptResult?.estimatedTokens"
      :theme="theme"
      @update:show="showPromptPreview = false"
      @refresh="openPromptAssistant"
    />

    <!-- 删除确认对话框 -->
    <component
      :is="ConfirmDialogComponent"
      v-bind="confirmDialogProps"
      @confirm="confirmDelete"
      @cancel="cancelDelete"
    />
  </div>
</template>
