<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  modelValue: string | number | undefined;
  type?: 'text' | 'password' | 'email' | 'number' | 'tel';
  placeholder?: string;
  disabled?: boolean;
  error?: boolean;
  min?: number;
  max?: number;
  step?: number | string;
}

const props = withDefaults(defineProps<Props>(), {
  type: 'text',
  placeholder: '',
  disabled: false,
  error: false,
});

const emit = defineEmits<{
  'update:modelValue': [value: string | number | undefined];
  'focus': [event: FocusEvent];
  'blur': [event: FocusEvent];
  'keydown': [event: KeyboardEvent];
}>();

const inputClasses = computed(() => [
  'form-input',
  {
    'form-input--error': props.error,
    'form-input--disabled': props.disabled,
  },
]);

const handleInput = (event: Event) => {
  const target = event.target as HTMLInputElement;
  let value: string | number = target.value;

  if (props.type === 'number') {
    value = parseFloat(value);
    if (isNaN(value)) value = '';
  }

  emit('update:modelValue', value as string | number);
};

const handleFocus = (event: FocusEvent) => {
  emit('focus', event);
};

const handleBlur = (event: FocusEvent) => {
  emit('blur', event);
};

const handleKeydown = (event: KeyboardEvent) => {
  emit('keydown', event);
};
</script>

<template>
  <input
    :type="type"
    :class="inputClasses"
    :placeholder="placeholder"
    :disabled="disabled"
    :value="modelValue"
    :min="min"
    :max="max"
    :step="step"
    @input="handleInput"
    @focus="handleFocus"
    @blur="handleBlur"
    @keydown="handleKeydown"
  />
</template>

<style scoped>
.form-input {
  width: 100%;
  padding: 11px 13px;
  background: var(--bg-primary);
  border: 1.5px solid var(--border-color);
  border-radius: 10px;
  color: var(--text-main);
  font-size: 14px;
  transition: all 0.2s ease;
  outline: none;
}

.form-input::placeholder {
  color: var(--text-muted);
  opacity: 0.5;
}

.form-input:focus {
  border-color: var(--accent-purple);
}

.form-input--error {
  border-color: #ef4444;
}

.form-input--error:focus {
  border-color: #ef4444;
}

.form-input--disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.form-input--disabled:focus {
  border-color: var(--border-color);
}
</style>