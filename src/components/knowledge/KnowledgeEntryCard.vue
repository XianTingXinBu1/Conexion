<script setup lang="ts">
import { computed } from 'vue';
import { GripVertical, Pencil, Trash2, Check, X } from 'lucide-vue-next';
import type { KnowledgeEntry } from '../../types';
import FormInput from '../form/FormInput.vue';
import FormTextarea from '../form/FormTextarea.vue';
import FormActions from '../form/FormActions.vue';

interface Props {
  index: number;
  entry: KnowledgeEntry;
  isEditing: boolean;
  isDragging: boolean;
  insertBefore: boolean;
  editingData?: Partial<KnowledgeEntry>;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  toggle: [id: string];
  startEdit: [entry: KnowledgeEntry];
  saveEdit: [];
  cancelEdit: [];
  delete: [id: string];
  dragStart: [index: number];
  dragEnd: [];
  touchStart: [index: number, event: TouchEvent];
  touchMove: [event: TouchEvent];
  touchEnd: [];
}>();

const cardClasses = computed(() => [
  'entry-card',
  {
    'entry-card--editing': props.isEditing,
    'entry-card--dragging': props.isDragging,
    'entry-card--insert-before': props.insertBefore,
    'entry-card--disabled': !props.entry.enabled,
  },
]);

const toggleSwitchClasses = computed(() => [
  'toggle-switch',
  { 'toggle-switch--active': props.entry.enabled },
]);

const actionBtnClasses = (type: 'edit' | 'delete') => [
  'action-btn',
  `action-btn--${type}`,
];

const updateName = (value: string | number | undefined) => {
  if (props.editingData) {
    props.editingData.name = String(value ?? '');
  }
};

const updatePriority = (value: string | number | undefined) => {
  if (props.editingData) {
    const numValue = typeof value === 'number' ? value : (typeof value === 'string' && value ? parseFloat(value) : 50);
    props.editingData.priority = isNaN(numValue) ? 50 : numValue;
  }
};

const updateContent = (value: string | undefined) => {
  if (props.editingData) {
    props.editingData.content = value ?? '';
  }
};

const getEditingDataName = (): string => {
  return props.editingData?.name ?? '';
};

const getEditingDataPriority = (): number => {
  return props.editingData?.priority ?? 50;
};

const getEditingDataContent = (): string => {
  return props.editingData?.content ?? '';
};

const canSave = computed(() => {
  return props.editingData?.name?.trim() && props.editingData?.content?.trim();
});
</script>

<template>
  <div :class="cardClasses">
    <template v-if="!isEditing">
      <div
        class="drag-handle"
        draggable="true"
        @dragstart="emit('dragStart', index)"
        @dragend="emit('dragEnd')"
        @touchstart="emit('touchStart', index, $event)"
        @touchmove="emit('touchMove', $event)"
        @touchend="emit('touchEnd')"
      >
        <GripVertical :size="18" />
      </div>
      <div class="entry-toggle">
        <button :class="toggleSwitchClasses" @click="emit('toggle', entry.id)">
          <div class="toggle-knob"></div>
        </button>
      </div>
      <div class="entry-info">
        <div class="entry-name">
          {{ entry.name }}
          <span class="priority-badge">{{ entry.priority }}</span>
        </div>
        <div class="entry-content">{{ entry.content }}</div>
      </div>
      <div class="entry-actions">
        <button :class="actionBtnClasses('edit')" @click="emit('startEdit', entry)">
          <Pencil :size="16" />
        </button>
        <button :class="actionBtnClasses('delete')" @click="emit('delete', entry.id)">
          <Trash2 :size="16" />
        </button>
      </div>
    </template>

    <template v-else>
      <div class="edit-form">
        <div class="form-group">
          <label class="form-label">名称</label>
          <FormInput
            :model-value="getEditingDataName()"
            type="text"
            placeholder="输入名称"
            @update:model-value="updateName"
          />
        </div>
        <div class="form-group">
          <label class="form-label">优先级 (1-100)</label>
          <FormInput
            :model-value="getEditingDataPriority()"
            type="number"
            :min="1"
            :max="100"
            placeholder="50"
            @update:model-value="updatePriority"
          />
        </div>
        <div class="form-group">
          <label class="form-label">内容</label>
          <FormTextarea
            :model-value="getEditingDataContent()"
            placeholder="输入内容"
            :rows="3"
            @update:model-value="updateContent"
          />
        </div>
        <FormActions
          :buttons="[
            { type: 'secondary', label: '取消', icon: X },
            { type: 'primary', label: '保存', icon: Check, disabled: !canSave },
          ]"
          :equal-width="true"
          @click="(_, index) => index === 1 ? emit('saveEdit') : emit('cancelEdit')"
        />
      </div>
    </template>
  </div>
</template>

<style scoped>
.entry-card {
  background: var(--bg-secondary);
  border-radius: 12px;
  padding: 14px;
  min-height: 74px;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  border: 1px solid var(--border-color);
  transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1),
              box-shadow 0.2s cubic-bezier(0.16, 1, 0.3, 1),
              border-color 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  position: relative;
  will-change: transform;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
}

.entry-card:active:active {
  animation: pulse 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(0.97);
  }
}

.entry-card--editing {
  border-color: var(--accent-purple);
  box-shadow: 0 0 0 2px rgba(157, 141, 241, 0.1);
}

.entry-card--dragging {
  transform: scale(1.02);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15);
}

.entry-card--insert-before {
  border-color: var(--accent-purple);
  border-width: 2px;
  box-shadow: 0 0 0 2px rgba(157, 141, 241, 0.2);
}

.entry-card--disabled .entry-info {
  opacity: 0.5;
}

.drag-handle {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: grab;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  flex-shrink: 0;
  touch-action: none;
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  user-select: none;
  margin-top: 6px;
}

.drag-handle:active {
  cursor: grabbing;
  color: var(--accent-purple);
  background: var(--accent-soft);
}

.entry-toggle {
  flex-shrink: 0;
  margin-top: 6px;
}

.toggle-switch {
  width: 44px;
  height: 24px;
  border-radius: 12px;
  border: none;
  background: var(--border-color);
  cursor: pointer;
  position: relative;
  transition: background 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  padding: 2px;
}

.toggle-switch--active {
  background: var(--accent-purple);
}

.toggle-switch:active {
  transform: scale(0.95);
}

.toggle-knob {
  width: 20px;
  height: 20px;
  background: white;
  border-radius: 50%;
  position: absolute;
  top: 2px;
  left: 2px;
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.toggle-switch--active .toggle-knob {
  transform: translateX(20px);
}

.entry-info {
  flex: 1;
  min-width: 0;
}

.entry-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-main);
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.priority-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 20px;
  padding: 0 6px;
  background: var(--accent-purple);
  color: white;
  font-size: 11px;
  font-weight: 600;
  border-radius: 4px;
  line-height: 1;
}

.entry-content {
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.entry-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
  margin-top: 6px;
}

.action-btn {
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
}

.action-btn:active {
  transform: scale(0.9);
  background: var(--accent-soft);
}

.action-btn--delete:active {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.edit-form {
  width: 100%;
  padding: 4px;
}

.form-group {
  margin-bottom: 12px;
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
</style>