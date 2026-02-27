<script setup lang="ts">
import { computed } from 'vue';
import { GripVertical, Pencil, Trash2, Check, X } from 'lucide-vue-next';
import type { PromptItem } from '../../types';
import FormInput from '../form/FormInput.vue';
import FormTextarea from '../form/FormTextarea.vue';
import FormActions from '../form/FormActions.vue';

interface Props {
  index: number;
  item: PromptItem;
  isEditing: boolean;
  isDragging: boolean;
  insertBefore: boolean;
  editingData?: Partial<PromptItem>;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  toggle: [id: string];
  startEdit: [item: PromptItem];
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
  'prompt-item',
  {
    'prompt-item--editing': props.isEditing,
    'prompt-item--dragging': props.isDragging,
    'prompt-item--insert-before': props.insertBefore,
    'prompt-item--disabled': !props.item.enabled,
  },
]);

const toggleSwitchClasses = computed(() => [
  'toggle-switch',
  { 'toggle-switch--active': props.item.enabled },
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

const updateDescription = (value: string | undefined) => {
  if (props.editingData) {
    props.editingData.description = value ?? '';
  }
};

const updatePrompt = (value: string | undefined) => {
  if (props.editingData) {
    props.editingData.prompt = value ?? '';
  }
};

const updateRoleType = (value: string | undefined) => {
  if (props.editingData) {
    props.editingData.roleType = value as 'system' | 'user' | 'assistant';
  }
};

const getEditingDataName = (): string => {
  return props.editingData?.name ?? '';
};

const getEditingDataDescription = (): string => {
  return props.editingData?.description ?? '';
};

const getEditingDataPrompt = (): string => {
  return props.editingData?.prompt ?? '';
};

const getEditingDataRoleType = (): 'system' | 'user' | 'assistant' => {
  return props.editingData?.roleType || 'system';
};

// 角色类型选项
const ROLE_OPTIONS = [
  { value: 'system', label: 'System' },
  { value: 'user', label: 'User' },
  { value: 'assistant', label: 'Assistant' }
];

// 计算是否可以保存
const canSave = computed(() => {
  return props.editingData?.name?.trim() && props.editingData?.description?.trim();
});

// 不显示提示词的系统预设条目 ID
const NO_PROMPT_ITEMS = ['character-setting', 'knowledge-base', 'user-setting', 'chat-history'];

// 计算是否应该显示提示词输入框
const shouldShowPrompt = computed(() => {
  return !NO_PROMPT_ITEMS.includes(props.item.id);
});

// 处理拖拽开始事件，防止事件冒泡
const onDragStart = (event: DragEvent) => {
  event.stopPropagation();
  emit('dragStart', props.index);
};

// 处理拖拽结束事件，防止事件冒泡
const onDragEnd = (event: DragEvent) => {
  event.stopPropagation();
  emit('dragEnd');
};

// 处理触摸开始事件，防止事件冒泡
const onTouchStart = (event: TouchEvent) => {
  event.stopPropagation();
  emit('touchStart', props.index, event);
};

// 处理触摸移动事件，防止事件冒泡
const onTouchMove = (event: TouchEvent) => {
  event.stopPropagation();
  emit('touchMove', event);
};

// 处理触摸结束事件，防止事件冒泡
const onTouchEnd = (event: TouchEvent) => {
  event.stopPropagation();
  emit('touchEnd');
};
</script>

<template>
  <div :class="cardClasses">
    <!-- 查看模式 -->
    <template v-if="!isEditing">
      <div
        class="drag-handle"
        draggable="true"
        @dragstart="onDragStart"
        @dragend="onDragEnd"
        @touchstart="onTouchStart"
        @touchmove="onTouchMove"
        @touchend="onTouchEnd"
      >
        <GripVertical :size="18" />
      </div>
      <div class="item-toggle">
        <button :class="toggleSwitchClasses" @click="emit('toggle', item.id)">
          <div class="toggle-knob"></div>
        </button>
      </div>
      <div class="prompt-info">
        <div class="prompt-name">{{ item.name }}</div>
        <div class="prompt-description">{{ item.description }}</div>
        <div v-if="item.prompt" class="prompt-content">{{ item.prompt }}</div>
      </div>
      <div class="item-actions">
        <button :class="actionBtnClasses('edit')" @click="emit('startEdit', item)">
          <Pencil :size="16" />
        </button>
        <button :class="actionBtnClasses('delete')" @click="emit('delete', item.id)">
          <Trash2 :size="16" />
        </button>
      </div>
    </template>

    <!-- 编辑模式 -->
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
          <label class="form-label">描述</label>
          <FormTextarea
            :model-value="getEditingDataDescription()"
            placeholder="输入描述"
            :rows="2"
            @update:model-value="updateDescription"
          />
        </div>
        <div v-if="shouldShowPrompt" class="form-group">
          <label class="form-label">角色类型</label>
          <div class="role-type-selector">
            <button
              v-for="option in ROLE_OPTIONS"
              :key="option.value"
              :class="['role-type-btn', { 'role-type-btn--active': getEditingDataRoleType() === option.value }]"
              @click="updateRoleType(option.value)"
            >
              {{ option.label }}
            </button>
          </div>
        </div>
        <div v-if="shouldShowPrompt" class="form-group">
          <label class="form-label">提示词</label>
          <FormTextarea
            :model-value="getEditingDataPrompt()"
            placeholder="输入提示词内容"
            :rows="4"
            @update:model-value="updatePrompt"
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
.prompt-item {
  background: var(--bg-secondary);
  border-radius: 12px;
  padding: 14px;
  min-height: 74px;
  display: flex;
  align-items: center;
  gap: 12px;
  border: 1px solid var(--border-color);
  transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1),
              box-shadow 0.2s cubic-bezier(0.16, 1, 0.3, 1),
              border-color 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  position: relative;
  will-change: transform;
}

.prompt-item--editing {
  border-color: var(--accent-purple);
  box-shadow: 0 0 0 2px rgba(157, 141, 241, 0.1);
}

.prompt-item--dragging {
  transform: scale(1.02);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15);
}

.prompt-item--insert-before {
  border-color: var(--accent-purple);
  border-width: 2px;
  box-shadow: 0 0 0 2px rgba(157, 141, 241, 0.2);
}

.prompt-item--disabled .prompt-info {
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
}

.drag-handle:active {
  cursor: grabbing;
  color: var(--accent-purple);
  background: var(--accent-soft);
}

.item-toggle {
  flex-shrink: 0;
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

.prompt-info {
  flex: 1;
  min-width: 0;
}

.prompt-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-main);
  margin-bottom: 3px;
}

.prompt-description {
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.4;
}

.prompt-content {
  font-size: 12px;
  color: var(--accent-purple);
  line-height: 1.4;
  margin-top: 4px;
  padding-top: 6px;
  border-top: 1px solid var(--border-color);
  white-space: pre-wrap;
  word-break: break-word;
  /* 最多显示 2 行，超出显示省略号 */
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
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

.role-type-selector {
  display: flex;
  gap: 8px;
}

.role-type-btn {
  flex: 1;
  padding: 8px 12px;
  border-radius: 8px;
  border: 1.5px solid var(--border-color);
  background: var(--bg-primary);
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.role-type-btn:active {
  transform: scale(0.97);
}

.role-type-btn--active {
  background: var(--accent-purple);
  border-color: var(--accent-purple);
  color: white;
}
</style>