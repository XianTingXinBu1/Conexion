<script setup lang="ts">
import { ref, computed } from 'vue';
import { X, Plus, Pencil, Trash2, Check } from 'lucide-vue-next';
import type { PromptPreset } from '../../types';
import Modal from '../common/Modal.vue';
import FormInput from '../form/FormInput.vue';

interface Props {
  show: boolean;
  presets: PromptPreset[];
  selectedPresetId: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  'update:show': [value: boolean];
  select: [presetId: string];
  rename: [presetId: string, name: string];
  delete: [presetId: string];
  addNew: [name: string];
}>();

// 对话框状态
const showAddDialog = ref(false);
const showRenameDialog = ref(false);
const addPresetName = ref('');
const renamePresetId = ref('');
const renamePresetName = ref('');

const handleAddPreset = () => {
  if (!addPresetName.value.trim()) return;
  emit('addNew', addPresetName.value.trim());
  showAddDialog.value = false;
  addPresetName.value = '';
};

const handleCancelAddPreset = () => {
  showAddDialog.value = false;
  addPresetName.value = '';
};

const openRenameDialog = (presetId: string) => {
  const preset = props.presets.find(p => p.id === presetId);
  if (preset) {
    renamePresetId.value = presetId;
    renamePresetName.value = preset.name;
    showRenameDialog.value = true;
  }
};

const handleRenamePreset = () => {
  if (!renamePresetName.value.trim()) return;
  emit('rename', renamePresetId.value, renamePresetName.value);
  showRenameDialog.value = false;
  renamePresetId.value = '';
  renamePresetName.value = '';
};

const handleCancelRenamePreset = () => {
  showRenameDialog.value = false;
  renamePresetId.value = '';
  renamePresetName.value = '';
};

const optionClasses = computed(() => (id: string) => [
  'preset-option',
  { 'preset-option--active': id === props.selectedPresetId },
]);

// 计算是否可以添加预设
const canAddPreset = computed(() => addPresetName.value.trim());

// 计算是否可以重命名
const canRenamePreset = computed(() => renamePresetName.value.trim());
</script>

<template>
  <Transition name="modal-fade">
    <div v-if="show" class="modal-overlay" @click="emit('update:show', false)">
      <Transition name="modal-slide">
        <div v-if="show" class="modal-content preset-menu" @click.stop>
          <div class="modal-header">
            <div class="modal-title">预设管理</div>
            <button class="modal-close" @click="emit('update:show', false)">
              <X :size="20" />
            </button>
          </div>
          <div class="modal-body">
            <div
              v-for="preset in presets"
              :key="preset.id"
              :class="optionClasses(preset.id)"
              @click="emit('select', preset.id)"
            >
              <div class="preset-option-info">
                <span class="preset-option-name">{{ preset.name }}</span>
                <span class="preset-option-count">{{ preset.items.length }} 条目</span>
              </div>
              <div class="preset-option-actions">
                <button class="preset-action-btn" @click.stop="openRenameDialog(preset.id)">
                  <Pencil :size="14" />
                </button>
                <button
                  v-if="presets.length > 1"
                  class="preset-action-btn preset-action-btn--delete"
                  @click.stop="emit('delete', preset.id)"
                >
                  <Trash2 :size="14" />
                </button>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn-full" @click="showAddDialog = true">
              <Plus :size="16" />
              添加预设
            </button>
          </div>
        </div>
      </Transition>
    </div>
  </Transition>

  <!-- 添加预设对话框 -->
  <Modal
    :show="showAddDialog"
    title="添加预设"
    size="md"
    @update:show="showAddDialog = $event"
  >
    <div class="form-group">
      <label class="form-label">预设名称</label>
      <FormInput
        v-model="addPresetName"
        type="text"
        placeholder="输入预设名称"
        @keydown.enter="handleAddPreset"
      />
    </div>
    <div class="form-hint">
      新预设将默认包含所有基本条目（主提示词、聊天历史等）
    </div>
    <template #footer>
      <div class="modal-footer-actions">
        <button class="btn-secondary" @click="handleCancelAddPreset">
          <X :size="16" />
          取消
        </button>
        <button
          class="btn-primary"
          :disabled="!canAddPreset"
          @click="handleAddPreset"
        >
          <Plus :size="16" />
          添加
        </button>
      </div>
    </template>
  </Modal>

  <!-- 重命名对话框 -->
  <Modal
    :show="showRenameDialog"
    title="重命名预设"
    size="md"
    @update:show="showRenameDialog = $event"
  >
    <div class="form-group">
      <label class="form-label">预设名称</label>
      <FormInput
        v-model="renamePresetName"
        type="text"
        placeholder="输入预设名称"
        @keydown.enter="handleRenamePreset"
      />
    </div>
    <template #footer>
      <div class="modal-footer-actions">
        <button class="btn-secondary" @click="handleCancelRenamePreset">
          <X :size="16" />
          取消
        </button>
        <button
          class="btn-primary"
          :disabled="!canRenamePreset"
          @click="handleRenamePreset"
        >
          <Check :size="16" />
          保存
        </button>
      </div>
    </template>
  </Modal>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  padding-top: calc(20px + env(safe-area-inset-top));
  padding-bottom: calc(20px + env(safe-area-inset-bottom));
}

.modal-content {
  background: var(--bg-secondary);
  border-radius: 16px;
  width: 100%;
  max-width: 400px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  border: 1px solid var(--accent-purple);
}

.preset-menu {
  max-height: 70vh;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
}

.modal-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-main);
}

.modal-close {
  width: 32px;
  height: 32px;
  border-radius: 8px;
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

.modal-close:active {
  transform: scale(0.9);
  background: var(--accent-soft);
}

.modal-body {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
}

.preset-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  background: var(--bg-primary);
  border-radius: 10px;
  border: 1.5px solid var(--border-color);
  cursor: pointer;
  transition: all 0.2s ease;
  margin-bottom: 8px;
}

.preset-option:last-child {
  margin-bottom: 0;
}

.preset-option:active {
  transform: scale(0.98);
}

.preset-option--active {
  border-color: var(--accent-purple);
  background: var(--accent-soft);
}

.preset-option-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.preset-option-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-main);
}

.preset-option-count {
  font-size: 12px;
  color: var(--text-muted);
}

.preset-option-actions {
  display: flex;
  gap: 4px;
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
}

.preset-action-btn:active {
  transform: scale(0.9);
  background: var(--accent-soft);
}

.preset-action-btn--delete:active {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.modal-footer {
  display: flex;
  padding: 16px 20px;
  border-top: 1px solid var(--border-color);
}

.btn-full {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 12px;
  background: var(--accent-purple);
  border: none;
  border-radius: 10px;
  color: white;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-full:active {
  transform: scale(0.98);
}

.form-group {
  margin-bottom: 12px;
}

.form-label {
  font-size: 13px;
  color: var(--text-muted);
  margin-bottom: 8px;
  font-weight: 500;
  display: block;
}

.form-hint {
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.5;
  margin-top: 12px;
}

.modal-footer-actions {
  display: flex;
  gap: 12px;
  width: 100%;
}

.btn-secondary,
.btn-primary {
  flex: 1;
  padding: 10px 16px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: all 0.2s ease;
  border: 1.5px solid transparent;
}

.btn-secondary {
  background: var(--bg-primary);
  border-color: var(--border-color);
  color: var(--text-main);
}

.btn-secondary:active {
  transform: scale(0.97);
  background: var(--accent-soft);
}

.btn-primary {
  background: var(--accent-purple);
  border-color: var(--accent-purple);
  color: white;
}

.btn-primary:active:not(:disabled) {
  transform: scale(0.97);
  background: var(--accent-purple-dark, #8b5cf6);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-slide-enter-active,
.modal-slide-leave-active {
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.modal-slide-enter-from {
  opacity: 0;
  transform: translateY(30px) scale(0.95);
}

.modal-slide-leave-to {
  opacity: 0;
  transform: translateY(20px) scale(0.98);
}
</style>