<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import Modal from '../common/Modal.vue';
import FormTextarea from '../form/FormTextarea.vue';

interface Props {
  show: boolean;
  messageId: string;
  content: string;
  isSaving?: boolean;
  error?: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  'update:show': [value: boolean];
  'save': [messageId: string, content: string];
  'close': [];
}>();

const editContent = ref(props.content);
const textareaRef = ref<InstanceType<typeof FormTextarea>>();

const handleClose = () => {
  if (props.isSaving) return;
  emit('update:show', false);
  emit('close');
};

const handleSave = () => {
  if (props.isSaving || !editContent.value.trim()) return;
  emit('save', props.messageId, editContent.value);
};

const handleCancel = () => {
  handleClose();
};

watch(() => [props.show, props.messageId] as const, ([newShow]) => {
  if (newShow) {
    editContent.value = props.content;
    nextTick(() => {
      textareaRef.value?.$el?.focus();
    });
  }
}, { immediate: true });
</script>

<template>
  <Modal
    :show="show"
    title="编辑消息"
    size="lg"
    @update:show="handleClose"
  >
    <div class="edit-message-modal">
      <FormTextarea
        ref="textareaRef"
        v-model="editContent"
        placeholder="输入消息内容..."
        aria-label="消息内容"
        :disabled="isSaving"
        :error="Boolean(error)"
        @keydown.ctrl.enter.prevent="handleSave"
        @keydown.meta.enter.prevent="handleSave"
        :rows="8"
        resize="vertical"
      />
      <p v-if="error" class="edit-error" role="alert">{{ error }}</p>
    </div>

    <template #footer>
      <button class="btn btn-secondary" :disabled="isSaving" @click="handleCancel">
        取消
      </button>
      <button class="btn btn-primary" :disabled="isSaving || !editContent.trim()" @click="handleSave">
        {{ isSaving ? '保存中…' : '保存' }}
      </button>
    </template>
  </Modal>
</template>

<style scoped>
.edit-message-modal {
  width: 100%;
}

.btn {
  padding: 10px 20px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
  flex: 1;
}

.edit-error {
  color: #ef4444;
  font-size: 13px;
  margin: 10px 0 0;
}

.btn:disabled {
  opacity: 0.5;
  cursor: default;
}

.btn-primary {
  background: var(--accent-purple);
  color: white;
}

.btn-primary:hover {
  opacity: 0.9;
}

.btn-primary:active {
  transform: scale(0.98);
}

.btn-secondary {
  background: var(--bg-primary);
  color: var(--text-main);
  border: 1.5px solid var(--border-color);
}

.btn-secondary:hover {
  background: var(--accent-soft);
}

.btn-secondary:active {
  transform: scale(0.98);
}
</style>