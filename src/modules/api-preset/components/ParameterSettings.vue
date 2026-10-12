<script setup lang="ts">
import { computed } from 'vue';
import { Sliders } from '@lucide/vue';
import FormToggle from '../../../components/form/FormToggle.vue';
import FormSlider from '../../../components/form/FormSlider.vue';
import FormInput from '../../../components/form/FormInput.vue';
import FormTextarea from '../../../components/form/FormTextarea.vue';
import { MAX_STOP_SEQUENCES } from '../../../constants';
import { formatStopSequences, parseStopSequences } from '../stopSequences';

interface Props {
  streamEnabled: boolean;
  showThinking?: boolean;
  temperature: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
  stopSequences: string[];
  seed?: number;
  contextLength: number;
  maxOutputTokens: number;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  'update:streamEnabled': [value: boolean];
  'update:showThinking': [value: boolean];
  'update:temperature': [value: number];
  'update:topP': [value: number];
  'update:frequencyPenalty': [value: number];
  'update:presencePenalty': [value: number];
  'update:stopSequences': [value: string[]];
  'update:seed': [value: number | undefined];
  'update:contextLength': [value: number];
  'update:maxOutputTokens': [value: number];
}>();

/**
 * 停止序列在 UI 里是「一行一条」，数据模型里是 `string[]`。
 * 解析规则集中在 `stopSequences.ts`，组件只负责接线。
 */
const stopText = computed({
  get: () => formatStopSequences(props.stopSequences),
  set: (text: string | undefined) => emit('update:stopSequences', parseStopSequences(text ?? '')),
});

const seedText = computed({
  get: () => (props.seed === undefined ? '' : String(props.seed)),
  set: (value: string | number | undefined) => {
    const trimmed = String(value ?? '').trim();
    if (trimmed === '') {
      emit('update:seed', undefined);
      return;
    }

    const parsed = Number(trimmed);
    emit('update:seed', Number.isFinite(parsed) ? Math.trunc(parsed) : undefined);
  },
});
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
    <div class="toggle-item">
      <div class="toggle-label">显示思考内容</div>
      <FormToggle :model-value="showThinking ?? true" @update:model-value="emit('update:showThinking', $event)" />
    </div>
    <p class="field-note">展示模型返回的原生思考内容，支持折叠查看。</p>
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
      :model-value="topP"
      :min="0"
      :max="1"
      :step="0.05"
      label="Top P（核采样）"
      :editable="true"
      :formatter="(v) => v.toFixed(2)"
      @update:model-value="emit('update:topP', $event)"
    />
    <FormSlider
      :model-value="frequencyPenalty"
      :min="-2"
      :max="2"
      :step="0.1"
      label="频率惩罚"
      :editable="true"
      :formatter="(v) => v.toFixed(1)"
      @update:model-value="emit('update:frequencyPenalty', $event)"
    />
    <FormSlider
      :model-value="presencePenalty"
      :min="-2"
      :max="2"
      :step="0.1"
      label="存在惩罚"
      :editable="true"
      :formatter="(v) => v.toFixed(1)"
      @update:model-value="emit('update:presencePenalty', $event)"
    />

    <div class="field-item">
      <div class="field-header">
        <span class="field-label">停止序列</span>
        <span class="field-counter">{{ stopSequences.length }}/{{ MAX_STOP_SEQUENCES }}</span>
      </div>
      <FormTextarea
        :model-value="stopText"
        :rows="3"
        placeholder="一行一条，如 ### 或 \\n\\nUser:"
        @update:model-value="stopText = $event"
      />
      <p class="field-note">
        每行一条，最多 {{ MAX_STOP_SEQUENCES }} 条；留空表示不设置。
        换行用 <code>\n</code>、制表符用 <code>\t</code> 转义。
      </p>
    </div>

    <div class="field-item">
      <div class="field-header">
        <span class="field-label">随机种子</span>
      </div>
      <FormInput
        :model-value="seedText"
        type="number"
        placeholder="留空则每次随机"
        @update:model-value="seedText = $event"
      />
      <p class="field-note">设置后相同输入与参数可复现同一输出，便于对比预设效果。</p>
    </div>

    <FormSlider
      :model-value="contextLength"
      :min="0"
      :max="200000"
      :step="1000"
      label="最大上下文 Tokens"
      :editable="true"
      :formatter="(v) => v.toLocaleString()"
      @update:model-value="emit('update:contextLength', $event)"
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

.field-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 8px 0;
}

.field-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.field-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-main);
}

.field-counter {
  font-size: 12px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}

.field-note {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-muted);
}

.field-note code {
  padding: 1px 4px;
  border-radius: 4px;
  background: var(--bg-subtle, rgba(127, 127, 127, 0.15));
  font-family: var(--font-mono, monospace);
  font-size: 11px;
}
</style>
