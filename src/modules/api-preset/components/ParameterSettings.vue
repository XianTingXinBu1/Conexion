<script setup lang="ts">
import { Sliders } from 'lucide-vue-next';
import FormToggle from '../../../components/form/FormToggle.vue';
import FormSlider from '../../../components/form/FormSlider.vue';

interface Props {
  streamEnabled: boolean;
  temperature: number;
  maxTokens: number;
  maxOutputTokens: number;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  'update:streamEnabled': [value: boolean];
  'update:temperature': [value: number];
  'update:maxTokens': [value: number];
  'update:maxOutputTokens': [value: number];
}>();
</script>

<template>
  <div class="section">
    <div class="section-title">
      <Sliders :size="18" />
      <span>参数设置</span>
    </div>
    <div class="toggle-item">
      <div class="toggle-label">流式输出</div>
      <FormToggle
        :model-value="streamEnabled"
        @update:model-value="emit('update:streamEnabled', $event)"
      />
    </div>
    <FormSlider
      :model-value="temperature"
      :min="0"
      :max="2"
      :step="0.1"
      label="温度"
      :editable="true"
      :formatter="(v) => v.toFixed(1)"
      @update:model-value="emit('update:temperature', $event)"
    />
    <FormSlider
      :model-value="maxTokens"
      :min="0"
      :max="200000"
      :step="1000"
      label="最大上下文 Tokens"
      :editable="true"
      :formatter="(v) => v.toLocaleString()"
      @update:model-value="emit('update:maxTokens', $event)"
    />
    <FormSlider
      :model-value="maxOutputTokens"
      :min="0"
      :max="128000"
      :step="128"
      label="最大输出 Tokens"
      :editable="true"
      :formatter="(v) => v.toLocaleString()"
      @update:model-value="emit('update:maxOutputTokens', $event)"
    />
  </div>
</template>

<style scoped>
.section {
  margin-bottom: 20px;
}

.section:last-child {
  margin-bottom: 0;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-muted);
  margin-bottom: 14px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.toggle-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
}

.toggle-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-main);
}

.section :deep(.form-slider-wrapper:not(:last-child)) {
  margin-bottom: 8px;
}
</style>