<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  modelValue: string;
  placeholder?: string;
  disabled?: boolean;
  error?: boolean;
  rows?: number;
  resize?: 'none' | 'vertical' | 'horizontal' | 'both';
  minRows?: number;
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: '',
  disabled: false,
  error: false,
  rows: 3,
  resize: 'vertical',
});

const emit = defineEmits<{
  'update:modelValue': [value: string | undefined];
  'focus': [event: FocusEvent];
  'blur': [event: FocusEvent];
}>();

const textareaClasses = computed(() => [
  'form-textarea',
  `form-textarea--${props.resize}`,
  {
    'form-textarea--error': props.error,
    'form-textarea--disabled': props.disabled,
  },
]);

const handleInput = (event: Event) => {
  const target = event.target as HTMLTextAreaElement;
  emit('update:modelValue', target.value);
};

const handleFocus = (event: FocusEvent) => {
  emit('focus', event);
};

const handleBlur = (event: FocusEvent) => {
  emit('blur', event);
};
</script>

<template>
  <textarea
    :class="textareaClasses"
    :placeholder="placeholder"
    :disabled="disabled"
    :value="modelValue"
    :rows="rows"
    @input="handleInput"
    @focus="handleFocus"
    @blur="handleBlur"
  />
</template>

<style scoped>
.form-textarea {
  width: 100%;
  padding: 11px 13px;
  background: var(--bg-primary);
  border: 1.5px solid var(--border-color);
  border-radius: 10px;
  color: var(--text-main);
  font-size: 14px;
  transition: all 0.2s ease;
  outline: none;
  font-family: inherit;
  line-height: 1.5;
}

.form-textarea::placeholder {
  color: var(--text-muted);
  opacity: 0.5;
}

.form-textarea:focus {
  border-color: var(--accent-purple);
}

.form-textarea--none {
  resize: none;
}

.form-textarea--vertical {
  resize: vertical;
}

.form-textarea--horizontal {
  resize: horizontal;
}

.form-textarea--both {
  resize: both;
}

.form-textarea--error {
  border-color: #ef4444;
}

.form-textarea--error:focus {
  border-color: #ef4444;
}

.form-textarea--disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.form-textarea--disabled:focus {
  border-color: var(--border-color);
}
</style>