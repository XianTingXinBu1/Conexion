<script setup lang="ts">
import { computed } from 'vue';

interface ButtonProps {
  type?: 'primary' | 'secondary' | 'danger';
  icon?: any;
  label: string;
  disabled?: boolean;
  loading?: boolean;
}

interface Props {
  buttons: ButtonProps[];
  align?: 'left' | 'center' | 'right' | 'space-between';
  equalWidth?: boolean; // 按钮等宽，用于移动端视觉平衡
}

const props = withDefaults(defineProps<Props>(), {
  align: 'right',
  equalWidth: false,
});

const emit = defineEmits<{
  click: [button: ButtonProps, index: number];
}>();

const wrapperClasses = computed(() => [
  'form-actions',
  `form-actions--${props.align}`,
]);

const buttonClasses = (button: ButtonProps) => [
  'form-action-btn',
  `form-action-btn--${button.type}`,
  {
    'form-action-btn--disabled': button.disabled || button.loading,
    'form-action-btn--loading': button.loading,
    'form-action-btn--equal-width': props.equalWidth,
  },
];

const handleClick = (button: ButtonProps, index: number) => {
  if (!button.disabled && !button.loading) {
    emit('click', button, index);
  }
};
</script>

<template>
  <div :class="wrapperClasses">
    <button
      v-for="(button, index) in buttons"
      :key="index"
      :class="buttonClasses(button)"
      :disabled="button.disabled || button.loading"
      @click="handleClick(button, index)"
    >
      <component
        v-if="button.icon && !button.loading"
        :is="button.icon"
        :size="16"
        class="form-action-btn-icon"
      />
      <span v-if="button.loading" class="form-action-btn-spinner" />
      <span>{{ button.label }}</span>
    </button>
  </div>
</template>

<style scoped>
.form-actions {
  display: flex;
  gap: 12px;
  margin-top: 16px;
  width: 100%;
}

.form-actions--left {
  justify-content: flex-start;
}

.form-actions--center {
  justify-content: center;
}

.form-actions--right {
  justify-content: flex-end;
}

.form-actions--space-between {
  justify-content: space-between;
}

.form-action-btn {
  flex: 0 0 auto;
  min-width: 80px;
  padding: 11px 20px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: none;
}

.form-action-btn--equal-width {
  flex: 1;
  min-width: 0;
}

.form-action-btn--primary {
  background: var(--accent-purple);
  color: white;
  box-shadow: 0 2px 8px rgba(157, 141, 241, 0.3);
}

.form-action-btn--primary:hover {
  box-shadow: 0 4px 12px rgba(157, 141, 241, 0.4);
  transform: translateY(-1px);
}

.form-action-btn--primary:active:not(:disabled) {
  transform: translateY(0) scale(0.98);
}

.form-action-btn--secondary {
  background: var(--bg-primary);
  border: 1.5px solid var(--border-color);
  color: var(--text-muted);
}

.form-action-btn--secondary:hover {
  border-color: var(--accent-purple);
  color: var(--text-main);
}

.form-action-btn--secondary:active:not(:disabled) {
  transform: scale(0.98);
  background: var(--accent-soft);
}

.form-action-btn--danger {
  background: #ef4444;
  color: white;
  box-shadow: 0 2px 8px rgba(239, 68, 68, 0.3);
}

.form-action-btn--danger:hover {
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
  transform: translateY(-1px);
}

.form-action-btn--danger:active:not(:disabled) {
  transform: translateY(0) scale(0.98);
}

.form-action-btn--disabled {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}

.form-action-btn--loading {
  opacity: 0.7;
  cursor: wait;
}

.form-action-btn-icon {
  flex-shrink: 0;
}

.form-action-btn-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  flex-shrink: 0;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>