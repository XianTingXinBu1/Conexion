<script setup lang="ts">
import { ref, nextTick, watch } from 'vue';
import { Send, Plus, Sparkles, Square } from 'lucide-vue-next';
import type { ChatRequestStatus } from '@/composables/useChatApi';

interface Props {
  enterToSend: boolean;
  isSending?: boolean;
  isRequestActive?: boolean;
  requestStatus?: ChatRequestStatus;
}

const props = withDefaults(defineProps<Props>(), {
  isSending: false,
  isRequestActive: false,
  requestStatus: 'idle',
});

const emit = defineEmits<{
  send: [message: string];
  cancel: [];
  showPromptAssistant: [];
}>();

const messageInput = ref('');
const messageInputRef = ref<HTMLTextAreaElement>();
const isToolbarExpanded = ref(false);

const adjustTextareaHeight = () => {
  if (messageInputRef.value) {
    messageInputRef.value.style.height = 'auto';
    const scrollHeight = messageInputRef.value.scrollHeight;
    const newHeight = Math.min(Math.max(scrollHeight, 40), 120);
    messageInputRef.value.style.height = `${newHeight}px`;
  }
};

const sendMessage = () => {
  const content = messageInput.value.trim();
  if (!content || props.isRequestActive) return;

  emit('send', content);
  messageInput.value = '';
  adjustTextareaHeight();
};

const cancelMessage = () => {
  if (!props.isRequestActive) {
    return;
  }

  emit('cancel');
};

const handleEnterKey = (event: KeyboardEvent) => {
  if (props.enterToSend) {
    event.preventDefault();

    if (props.isRequestActive) {
      cancelMessage();
      return;
    }

    sendMessage();
  }
};

const toggleToolbar = () => {
  isToolbarExpanded.value = !isToolbarExpanded.value;
};

const handlePromptAssistant = () => {
  emit('showPromptAssistant');
  isToolbarExpanded.value = false;
};

watch(messageInput, () => {
  nextTick(() => {
    adjustTextareaHeight();
  });
});

defineExpose({
  focus: () => {
    messageInputRef.value?.focus();
  },
});
</script>

<template>
  <div class="chat-input-area">
    <transition name="fade-slide">
      <div v-if="isToolbarExpanded" class="toolbar-panel">
        <div class="toolbar-grid">
          <button class="toolbar-item" @click="handlePromptAssistant">
            <div class="icon-wrapper"><Sparkles :size="20" /></div>
            <span>提示词助手</span>
          </button>
        </div>
      </div>
    </transition>

    <div class="input-container">
      <button
        class="toolbar-toggle-btn"
        @click="toggleToolbar"
        :class="{ active: isToolbarExpanded }"
      >
        <Plus :size="22" />
      </button>

      <textarea
        ref="messageInputRef"
        v-model="messageInput"
        class="message-input"
        :placeholder="isRequestActive ? '正在生成，可点击停止...' : '输入消息...'"
        :disabled="isRequestActive"
        @keydown.enter="handleEnterKey"
        rows="1"
      />

      <button
        v-if="isRequestActive"
        class="send-btn stop-btn"
        @click="cancelMessage"
        title="停止生成"
      >
        <Square :size="18" />
      </button>
      <button
        v-else
        class="send-btn"
        @click="sendMessage"
        :disabled="!messageInput.trim()"
        :title="requestStatus === 'cancelled' ? '重新输入后发送' : '发送'"
      >
        <Send :size="18" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.chat-input-area {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 20px;
  background: var(--bg-secondary);
  border-top: 1px solid var(--border-color);
  flex-shrink: 0;
}

/* 工具栏面板动画 */
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  transform-origin: bottom center;
}

.fade-slide-enter-from,
.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(10px) scale(0.98);
}

/* 工具栏网格 */
.toolbar-grid {
  display: grid;
  grid-template-columns: repeat(1, 1fr);
  gap: 12px;
  padding: 16px;
  background: var(--bg-primary);
  border-radius: 16px;
  border: 1px solid var(--border-color);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.05);
}

[data-theme='dark'] .toolbar-grid {
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
}

/* 工具栏按钮 */
.toolbar-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 12px 8px;
  background: transparent;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  color: var(--text-main);
  transition: all 0.2s ease;
}

.icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  background: var(--bg-secondary);
  border-radius: 12px;
  transition: all 0.2s ease;
}

.toolbar-item span {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-muted);
  transition: color 0.2s ease;
}

.toolbar-item:hover .icon-wrapper {
  background: var(--accent-purple);
  color: white;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(157, 141, 241, 0.25);
}

.toolbar-item:hover span {
  color: var(--text-main);
}

.toolbar-item:active .icon-wrapper {
  transform: translateY(0);
}

/* 输入容器 */
.input-container {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  background: var(--bg-primary);
  border-radius: 24px;
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.02);
}

.input-container:focus-within {
  border-color: var(--accent-purple);
  box-shadow: 0 0 0 3px rgba(157, 141, 241, 0.15);
}

/* 切换按钮 */
.toolbar-toggle-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  flex-shrink: 0;
  margin-bottom: 2px;
}

.toolbar-toggle-btn:hover {
  background: var(--bg-tertiary);
  color: var(--text-main);
}

.toolbar-toggle-btn.active {
  transform: rotate(45deg);
  color: var(--accent-purple);
}

/* 文本输入框 */
.message-input {
  flex: 1;
  border: none;
  background: transparent;
  outline: none;
  font-size: 15px;
  color: var(--text-main);
  padding: 8px 0;
  line-height: 1.5;
  min-width: 0;
  resize: none;
  max-height: 120px;
  overflow-y: auto;
  font-family: inherit;
  font-weight: 400;
  height: 40px;
  transition: height 0.1s ease;
}

.message-input::placeholder {
  color: var(--text-muted);
}

.message-input:disabled {
  cursor: default;
  opacity: 0.85;
}

/* 发送按钮 */
.send-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  background: linear-gradient(135deg, var(--accent-purple), #8b7cf6);
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.send-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 18px rgba(157, 141, 241, 0.35);
}

.send-btn:active:not(:disabled) {
  transform: translateY(0);
}

.send-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  box-shadow: none;
}

.stop-btn {
  background: linear-gradient(135deg, #f97316, #ef4444);
}

.stop-btn:hover {
  box-shadow: 0 6px 18px rgba(239, 68, 68, 0.28);
}
</style>
