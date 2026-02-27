<script setup lang="ts">
import { ref, watch } from 'vue';

interface Props {
  show: boolean;
  type?: 'delete' | 'warning' | 'info';
  title: string;
  message: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
}

const props = withDefaults(defineProps<Props>(), {
  type: 'info',
  confirmText: '确定',
  cancelText: '取消',
});

const emit = defineEmits<{
  confirm: [];
  cancel: [];
  updateShow: [value: boolean];
}>();

const localShow = ref(props.show);

watch(() => props.show, (newValue) => {
  localShow.value = newValue;
});

const handleConfirm = () => {
  emit('confirm');
  emit('updateShow', false);
};

const handleCancel = () => {
  emit('cancel');
  emit('updateShow', false);
};

const handleClose = () => {
  emit('cancel');
  emit('updateShow', false);
};

const getIcon = () => {
  switch (props.type) {
    case 'delete':
      return '⚠️';
    case 'warning':
      return '⚡';
    default:
      return 'ℹ️';
  }
};

const getIconColor = () => {
  switch (props.type) {
    case 'delete':
      return '#ef4444';
    case 'warning':
      return '#f59e0b';
    default:
      return '#9D8DF1';
  }
};

const getConfirmBtnStyle = () => {
  switch (props.type) {
    case 'delete':
      return {
        background: '#ef4444',
        color: '#ffffff',
      };
    case 'warning':
      return {
        background: '#f59e0b',
        color: '#ffffff',
      };
    default:
      return {
        background: '#9D8DF1',
        color: '#ffffff',
      };
  }
};
</script>

<template>
  <Transition name="modal-fade">
    <div v-if="localShow" class="modal-overlay" @click="handleClose">
      <div class="modal-content" @click.stop>
        <!-- 图标 -->
        <div class="modal-icon" :style="{ color: getIconColor() }">
          {{ getIcon() }}
        </div>

        <!-- 标题 -->
        <div class="modal-title">{{ title }}</div>

        <!-- 消息 -->
        <div class="modal-message">{{ message }}</div>

        <!-- 描述（可选） -->
        <div v-if="description" class="modal-description">{{ description }}</div>

        <!-- 按钮组 -->
        <div class="modal-actions">
          <button class="btn btn-cancel" @click="handleCancel">
            {{ cancelText }}
          </button>
          <button
            class="btn btn-confirm"
            :style="getConfirmBtnStyle()"
            @click="handleConfirm"
          >
            {{ confirmText }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.modal-content {
  width: 100%;
  max-width: 320px;
  background: var(--bg-secondary);
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  animation: modal-slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes modal-slide-up {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.modal-icon {
  font-size: 48px;
  text-align: center;
  margin-bottom: 16px;
}

.modal-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-main);
  text-align: center;
  margin-bottom: 12px;
}

.modal-message {
  font-size: 14px;
  color: var(--text-muted);
  text-align: center;
  line-height: 1.5;
  margin-bottom: 8px;
}

.modal-description {
  font-size: 12px;
  color: var(--text-muted);
  text-align: center;
  opacity: 0.8;
  margin-bottom: 24px;
  line-height: 1.6;
}

.modal-actions {
  display: flex;
  gap: 12px;
}

.btn {
  flex: 1;
  padding: 12px;
  border-radius: 10px;
  border: none;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn:active {
  transform: scale(0.96);
}

.btn-cancel {
  background: transparent;
  color: var(--text-muted);
  border: 1px solid var(--border-color);
}

.btn-cancel:active {
  background: var(--accent-soft);
}

.btn-confirm {
  color: #ffffff;
}

.btn-confirm:active {
  opacity: 0.8;
}

/* 淡入淡出动画 */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.2s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}
</style>