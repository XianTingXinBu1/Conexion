<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  modelValue: boolean;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  size: 'md',
});

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
}>();

const toggleClasses = computed(() => [
  'form-toggle',
  `form-toggle--${props.size}`,
  {
    'form-toggle--active': props.modelValue,
    'form-toggle--disabled': props.disabled,
  },
]);

const handleClick = () => {
  if (!props.disabled) {
    emit('update:modelValue', !props.modelValue);
  }
};
</script>

<template>
  <div class="form-toggle-wrapper">
    <button
      :class="toggleClasses"
      :disabled="disabled"
      @click="handleClick"
    >
      <div class="form-toggle-knob" />
    </button>
    <span v-if="label" class="form-toggle-label">{{ label }}</span>
  </div>
</template>

<style scoped>
.form-toggle-wrapper {
  display: flex;
  align-items: center;
  gap: 10px;
}

.form-toggle {
  position: relative;
  border: none;
  border-radius: 12px;
  background: var(--border-color);
  cursor: pointer;
  transition: background 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  padding: 2px;
  flex-shrink: 0;
}

.form-toggle:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.form-toggle--sm {
  width: 36px;
  height: 20px;
  border-radius: 10px;
}

.form-toggle--md {
  width: 44px;
  height: 24px;
  border-radius: 12px;
}

.form-toggle--lg {
  width: 52px;
  height: 28px;
  border-radius: 14px;
}

.form-toggle--active {
  background: var(--accent-purple);
}

.form-toggle-knob {
  position: absolute;
  top: 2px;
  left: 2px;
  background: white;
  border-radius: 50%;
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.form-toggle--sm .form-toggle-knob {
  width: 16px;
  height: 16px;
}

.form-toggle--md .form-toggle-knob {
  width: 20px;
  height: 20px;
}

.form-toggle--lg .form-toggle-knob {
  width: 24px;
  height: 24px;
}

.form-toggle--active .form-toggle-knob {
  transform: translateX(
    calc(100% + 4px)
  );
}

.form-toggle--sm.form-toggle--active .form-toggle-knob {
  transform: translateX(16px);
}

.form-toggle--md.form-toggle--active .form-toggle-knob {
  transform: translateX(20px);
}

.form-toggle--lg.form-toggle--active .form-toggle-knob {
  transform: translateX(24px);
}

.form-toggle:active:not(:disabled) {
  transform: scale(0.95);
}

.form-toggle-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-main);
}
</style>