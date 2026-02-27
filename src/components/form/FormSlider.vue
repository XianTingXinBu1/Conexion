<script setup lang="ts">
import { ref, computed } from 'vue';

interface Props {
  modelValue: number;
  min: number;
  max: number;
  step: number;
  label?: string;
  disabled?: boolean;
  editable?: boolean;
  formatter?: (value: number) => string;
  parser?: (value: string) => number;
}

const props = withDefaults(defineProps<Props>(), {
  label: '',
  disabled: false,
  editable: false,
  formatter: (value: number) => value.toString(),
  parser: (value: string) => parseFloat(value),
});

const emit = defineEmits<{
  'update:modelValue': [value: number];
}>();

const isEditing = ref(false);
const editValue = ref('');
const inputRef = ref<HTMLInputElement>();

const displayValue = computed(() => {
  if (isEditing.value) {
    return editValue.value;
  }
  return props.formatter(props.modelValue);
});

const sliderClasses = computed(() => [
  'form-slider',
  {
    'form-slider--disabled': props.disabled,
  },
]);

const valueDisplayClasses = computed(() => [
  'form-slider-value',
  {
    'form-slider-value--editable': props.editable && !props.disabled,
  },
]);

const handleInput = (event: Event) => {
  const target = event.target as HTMLInputElement;
  const value = parseFloat(target.value);
  if (!isNaN(value)) {
    emit('update:modelValue', value);
  }
};

const startEditing = () => {
  if (!props.editable || props.disabled) return;
  editValue.value = props.modelValue.toString();
  isEditing.value = true;
  setTimeout(() => inputRef.value?.focus(), 0);
};

const finishEditing = () => {
  if (!isEditing.value) return;
  const value = props.parser(editValue.value);
  if (!isNaN(value) && value >= props.min && value <= props.max) {
    emit('update:modelValue', value);
  }
  isEditing.value = false;
};

const cancelEditing = () => {
  isEditing.value = false;
};

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter') {
    finishEditing();
  } else if (event.key === 'Escape') {
    cancelEditing();
  }
};
</script>

<template>
  <div class="form-slider-wrapper">
    <div v-if="label" class="form-slider-header">
      <span class="form-slider-label">{{ label }}</span>
      <span
        v-if="!isEditing"
        :class="valueDisplayClasses"
        @click="startEditing"
      >
        {{ displayValue }}
      </span>
      <input
        v-else
        ref="inputRef"
        v-model="editValue"
        class="form-slider-input"
        type="number"
        :min="min"
        :max="max"
        :step="step"
        @blur="finishEditing"
        @keydown="handleKeydown"
      />
    </div>
    <input
      :class="sliderClasses"
      type="range"
      :value="modelValue"
      :min="min"
      :max="max"
      :step="step"
      :disabled="disabled"
      @input="handleInput"
    />
  </div>
</template>

<style scoped>
.form-slider-wrapper {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-slider-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.form-slider-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-main);
}

.form-slider-value {
  font-size: 13px;
  color: var(--accent-purple);
  font-weight: 600;
  min-width: 32px;
  text-align: right;
}

.form-slider-value--editable {
  cursor: pointer;
  border-radius: 4px;
  padding: 2px 4px;
  transition: background 0.2s ease;
}

.form-slider-value--editable:hover {
  background: var(--accent-soft);
}

.form-slider-input {
  font-size: 13px;
  color: var(--accent-purple);
  font-weight: 600;
  min-width: 32px;
  text-align: right;
  background: var(--bg-primary);
  border: 1.5px solid var(--accent-purple);
  border-radius: 4px;
  padding: 2px 4px;
  outline: none;
  width: 60px;
}

.form-slider {
  width: 100%;
  height: 5px;
  -webkit-appearance: none;
  appearance: none;
  background: var(--border-color);
  border-radius: 3px;
  outline: none;
  cursor: pointer;
}

.form-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  background: var(--accent-purple);
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 6px rgba(157, 141, 241, 0.3);
}

.form-slider::-webkit-slider-thumb:hover {
  transform: scale(1.1);
}

.form-slider::-moz-range-thumb {
  width: 18px;
  height: 18px;
  background: var(--accent-purple);
  border: none;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.2s ease;
}

.form-slider--disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.form-slider--disabled::-webkit-slider-thumb {
  cursor: not-allowed;
}
</style>