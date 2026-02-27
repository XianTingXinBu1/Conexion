<script setup lang="ts">
import { ref } from 'vue';
import { ChevronDown, Plus, Trash2, Edit2 } from 'lucide-vue-next';
import type { Preset } from '../types';

interface Props {
  presets: Preset[];
  selectedPresetId: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  select: [presetId: string];
  rename: [presetId: string];
  delete: [presetId: string];
  createNew: [];
}>();

const showPresetList = ref(false);

const openRenameDialog = (presetId: string) => {
  showPresetList.value = false;
  emit('rename', presetId);
};

const openDeleteDialog = (presetId: string) => {
  showPresetList.value = false;
  emit('delete', presetId);
};

const handleCreateNew = () => {
  showPresetList.value = false;
  emit('createNew');
};
</script>

<template>
  <div class="preset-selector">
    <div class="selector-label">选择预设</div>
    <div class="model-dropdown">
      <button class="selector-btn" @click="showPresetList = !showPresetList">
        <span>{{ presets.find(p => p.id === selectedPresetId)?.name || '选择预设' }}</span>
        <ChevronDown :size="16" :class="{ 'rotate': showPresetList }" />
      </button>
      <div v-if="showPresetList" class="dropdown-menu preset-dropdown">
        <div class="dropdown-list">
          <div
            v-for="preset in presets"
            :key="preset.id"
            class="dropdown-item preset-item"
            :class="{ 'active': preset.id === selectedPresetId }"
            @click="emit('select', preset.id)"
          >
            <span class="preset-name">{{ preset.name }}</span>
            <div class="preset-actions">
              <button class="preset-action-btn" @click.stop="openRenameDialog(preset.id)">
                <Edit2 :size="14" />
              </button>
              <button v-if="presets.length > 1" class="preset-action-btn delete" @click.stop="openDeleteDialog(preset.id)">
                <Trash2 :size="14" />
              </button>
            </div>
          </div>
        </div>
        <div class="dropdown-footer">
          <button class="new-preset-btn" @click="handleCreateNew">
            <Plus :size="16" />
            <span>新建预设</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.preset-selector {
  padding: 14px 16px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.selector-label {
  font-size: 13px;
  color: var(--text-muted);
  margin-bottom: 8px;
  font-weight: 500;
}

.model-dropdown {
  position: relative;
  display: flex;
  gap: 8px;
}

.selector-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  background: var(--bg-primary);
  border: 1.5px solid var(--border-color);
  border-radius: 10px;
  color: var(--text-main);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.selector-btn:active {
  border-color: var(--accent-purple);
  transform: scale(0.98);
}

.preset-dropdown {
  top: calc(100% + 4px);
  max-height: 300px;
}

.preset-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
}

.preset-item.active {
  background: var(--accent-soft);
}

.preset-name {
  flex: 1;
}

.preset-actions {
  display: flex;
  gap: 4px;
  margin-left: 8px;
}

.preset-action-btn {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.preset-action-btn:hover {
  background: var(--accent-soft);
  color: var(--text-main);
}

.preset-action-btn.delete:hover {
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;
}

.dropdown-footer {
  padding: 8px;
  border-top: 1px solid var(--border-color);
}

.new-preset-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px;
  background: var(--accent-soft);
  border: none;
  border-radius: 8px;
  color: var(--accent-purple);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.new-preset-btn:active {
  transform: scale(0.98);
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

.rotate {
  transform: rotate(180deg);
}
</style>