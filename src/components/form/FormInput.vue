<script setup lang="ts">
import { computed, ref } from 'vue';

interface Props {
  /** 传进来才能被父层的 <label for> 关联上 */
  id?: string;
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
  id: undefined,
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

/**
 * 聚焦期间的原始文本。
 *
 * 数字输入不能把「显示值」完全派生自 modelValue：逐字符 parseFloat 会把 `1.`
 * 解析成 `1`，回填后小数点被吃掉、光标跳到末尾，于是温度/种子这类小数根本打不出来。
 * 所以输入过程中保留用户敲的原文，失焦后再回落到归一化后的值。
 */
const rawValue = ref<string | null>(null);

const displayValue = computed<string | number>(() => {
  if (rawValue.value !== null) return rawValue.value;
  return props.modelValue === undefined || props.modelValue === null ? '' : props.modelValue;
});

const handleInput = (event: Event) => {
  const target = event.target as HTMLInputElement;
  const text = target.value;

  if (props.type !== 'number') {
    emit('update:modelValue', text);
    return;
  }

  rawValue.value = text;

  const trimmed = text.trim();
  if (trimmed === '') {
    emit('update:modelValue', '');
    return;
  }

  const parsed = Number(trimmed);
  // 输入到一半（如 `-`、`1.`）先不发数字，避免把中间态写回 props 再回灌到输入框
  emit('update:modelValue', Number.isFinite(parsed) ? parsed : '');
};

const handleFocus = (event: FocusEvent) => {
  emit('focus', event);
};

const handleBlur = (event: FocusEvent) => {
  // 失焦后回到归一化显示（例如 `1.` → `1`）
  rawValue.value = null;
  emit('blur', event);
};

const handleKeydown = (event: KeyboardEvent) => {
  emit('keydown', event);
};

const inputRef = ref<HTMLInputElement | null>(null);

// 供父组件通过模板 ref 调用（模板 ref 拿到的是组件实例，
// 不 expose 的话 value.focus 是 undefined，调用即抛错）。
defineExpose({
  focus: () => inputRef.value?.focus(),
  blur: () => inputRef.value?.blur(),
  select: () => inputRef.value?.select(),
});
</script>

<template>
  <input
    ref="inputRef"
    :id="id"
    :type="type"
    :aria-invalid="error || undefined"
    :class="inputClasses"
    :placeholder="placeholder"
    :disabled="disabled"
    :value="displayValue"
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