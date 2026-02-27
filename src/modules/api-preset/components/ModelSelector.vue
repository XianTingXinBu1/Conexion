<script setup lang="ts">
import { ref, computed } from 'vue';
import { ChevronDown, Database } from 'lucide-vue-next';
import type { Model } from '../../../types';
import { filterModels } from '../../../data/modelData';

interface Props {
  models: Model[];
  selectedModel: string;
  modelInput: string;
  isLoading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  isLoading: false,
  modelInput: '',
});

const emit = defineEmits<{
  'update:selectedModel': [modelId: string];
  'update:modelInput': [value: string];
  fetchModels: [];
}>();

const showModelList = ref(false);

const filteredModels = computed(() => filterModels(props.modelInput, props.models));

const handleInput = (e: Event) => {
  const value = (e.target as HTMLInputElement).value;
  emit('update:modelInput', value);
  // 手动输入时也更新 selectedModel
  emit('update:selectedModel', value);
};

const selectModel = (modelId: string) => {
  emit('update:selectedModel', modelId);
  const model = props.models.find(m => m.id === modelId);
  emit('update:modelInput', model?.name ?? modelId);
  showModelList.value = false;
};

const formatContextLength = (length: number): string => {
  if (length >= 1000000) {
    return `${(length / 1000000).toFixed(1)}M`;
  } else if (length >= 1000) {
    return `${(length / 1000).toFixed(1)}K`;
  }
  return length.toString();
};
</script>

<template>
  <div class="model-selector">
    <div class="form-group">
      <label class="form-label">模型名称</label>
      <div class="model-dropdown">
        <input
          :value="modelInput"
          class="dropdown-input"
          placeholder="输入或选择模型..."
          @focus="showModelList = true"
          @input="handleInput"
        />
        <button class="dropdown-arrow" @click="showModelList = !showModelList">
          <ChevronDown :size="14" :class="{ 'rotate': showModelList }" />
        </button>
        <div v-if="showModelList" class="dropdown-menu">
          <div class="dropdown-list">
            <div
              v-for="model in filteredModels"
              :key="model.id"
              class="dropdown-item"
              @click="selectModel(model.id)"
            >
              <div class="model-name">{{ model.name }}</div>
              <div v-if="model.description" class="model-description">{{ model.description }}</div>
              <div v-if="model.contextLength" class="model-info">上下文: {{ formatContextLength(model.contextLength) }}</div>
            </div>
            <div v-if="filteredModels.length === 0" class="dropdown-empty">
              {{ models.length === 0 ? '点击下方按钮获取模型列表' : '未找到匹配的模型' }}
            </div>
          </div>
        </div>
      </div>
    </div>
    <button class="fetch-models-btn" @click="emit('fetchModels')" :disabled="isLoading">
      <Database :size="16" />
      <span>{{ isLoading ? '获取中...' : '获取模型列表' }}</span>
    </button>
  </div>
</template>

<style scoped>
.model-selector {
  margin-bottom: 20px;
}

.form-group {
  margin-bottom: 14px;
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-label {
  font-size: 13px;
  color: var(--text-muted);
  margin-bottom: 8px;
  font-weight: 500;
  display: block;
}

.model-dropdown {
  position: relative;
  display: flex;
  gap: 8px;
}

.dropdown-input {
  flex: 1;
  padding: 12px 14px;
  background: var(--bg-secondary);
  border: 1.5px solid var(--border-color);
  border-radius: 10px;
  color: var(--text-main);
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s ease;
  outline: none;
}

.dropdown-input::placeholder {
  color: var(--text-muted);
  opacity: 0.5;
}

.dropdown-input:focus {
  border-color: var(--accent-purple);
}

.dropdown-arrow {
  width: 44px;
  padding: 0;
  background: var(--bg-secondary);
  border: 1.5px solid var(--border-color);
  border-radius: 10px;
  color: var(--text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.dropdown-arrow:active {
  background: var(--accent-soft);
  color: var(--text-main);
}

.rotate {
  transform: rotate(180deg);
}

.dropdown-menu {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: var(--bg-secondary);
  border: 1.5px solid var(--border-color);
  border-radius: 10px;
  overflow: hidden;
  z-index: 100;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
}

.dropdown-list {
  max-height: 200px;
  overflow-y: auto;
}

.dropdown-item {
  padding: 12px 14px;
  font-size: 14px;
  color: var(--text-main);
  cursor: pointer;
  transition: all 0.15s ease;
  border-bottom: 1px solid var(--border-color);
}

.dropdown-item:last-child {
  border-bottom: none;
}

.dropdown-item:hover {
  background: var(--accent-soft);
}

.model-name {
  font-weight: 500;
  margin-bottom: 4px;
}

.model-description {
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.model-info {
  font-size: 11px;
  color: var(--text-muted);
  opacity: 0.7;
}

.dropdown-empty {
  padding: 16px;
  text-align: center;
  font-size: 13px;
  color: var(--text-muted);
}

.fetch-models-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 11px;
  background: var(--bg-secondary);
  border: 1.5px solid var(--border-color);
  border-radius: 10px;
  color: var(--text-main);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-top: 8px;
}

.fetch-models-btn:active:not(:disabled) {
  border-color: var(--accent-purple);
  transform: scale(0.98);
}

.fetch-models-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>