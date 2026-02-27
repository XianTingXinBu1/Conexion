<script setup lang="ts">
import { ref, nextTick, watch } from 'vue';
import { Send } from 'lucide-vue-next';

interface Props {
  enterToSend: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  send: [message: string];
}>();

const messageInput = ref('');
const messageInputRef = ref<HTMLTextAreaElement>();

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
  if (!content) return;

  emit('send', content);
  messageInput.value = '';
  adjustTextareaHeight();
};

const handleEnterKey = (event: KeyboardEvent) => {
  if (props.enterToSend) {
    event.preventDefault();
    sendMessage();
  }
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
    <div class="input-container">
      <textarea
        ref="messageInputRef"
        v-model="messageInput"
        class="message-input"
        placeholder="输入消息..."
        @keydown.enter="handleEnterKey"
        rows="1"
      />
      <button
        class="send-btn"
        @click="sendMessage"
        :disabled="!messageInput.trim()"
      >
        <Send :size="16" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.chat-input-area {
  padding: 20px 16px;
  background: var(--bg-secondary);
  border-top: 1px solid var(--border-color);
  flex-shrink: 0;
}

.input-container {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  background: var(--bg-secondary);
  border-radius: 24px;
  padding: 4px 14px;
  border: 1px solid var(--border-color);
  transition: border-color 0.2s ease;
}

.input-container:focus-within {
  border-color: var(--accent-purple);
}

.message-input {
  flex: 1;
  border: none;
  background: transparent;
  outline: none;
  font-size: 15px;
  color: var(--text-main);
  padding: 10px 0;
  line-height: 20px;
  min-width: 0;
  resize: none;
  max-height: 120px;
  overflow-y: auto;
  font-family: inherit;
  font-weight: 400;
  height: 40px;
  transition: height 0.15s ease;
}

.message-input::placeholder {
  color: var(--text-muted);
  opacity: 0.5;
}

.message-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.message-input::-webkit-scrollbar {
  width: 0;
}

.send-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background: var(--accent-purple);
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  flex-shrink: 0;
  margin-bottom: 4px;
}

.send-btn:hover:not(:disabled) {
  opacity: 0.85;
}

.send-btn:active:not(:disabled) {
  transform: scale(0.95);
}

.send-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.send-btn svg {
  width: 16px;
  height: 16px;
}

[data-theme='dark'] .send-btn {
  background: var(--accent-purple);
}
</style>