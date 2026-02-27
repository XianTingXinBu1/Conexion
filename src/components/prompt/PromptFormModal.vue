<script setup lang="ts">
import { ref, watch, nextTick, computed } from 'vue';
import { Plus, X } from 'lucide-vue-next';
import type { PromptItem } from '../../types';
import Modal from '../common/Modal.vue';
import FormInput from '../form/FormInput.vue';
import FormTextarea from '../form/FormTextarea.vue';

interface Props {
  show: boolean;
  mode?: 'create' | 'edit';
  item?: Partial<PromptItem>;
}

const props = withDefaults(defineProps<Props>(), {
  mode: 'create',
  item: () => ({}),
});

const emit = defineEmits<{
  'update:show': [value: boolean];
  save: [item: Partial<PromptItem>];
}>();

// 表单数据
const formData = ref<Partial<PromptItem> & { name: string; description: string; prompt: string; roleType: 'system' | 'user' | 'assistant' }>({
  name: '',
  description: '',
  prompt: '',
  roleType: 'system',
});

// 表单错误状态
const formError = ref('');
const nameInputRef = ref<HTMLInputElement | null>(null);

// 计算是否可以保存
const canSave = computed(() => {
  return formData.value.name?.trim() && formData.value.description?.trim();
});

// 不显示提示词的系统预设条目 ID
const NO_PROMPT_ITEMS = ['character-setting', 'knowledge-base', 'user-setting', 'chat-history'];

// 计算是否应该显示提示词输入框
const shouldShowPrompt = computed(() => {
  // 创建新条目时总是显示
  if (props.mode === 'create') return true;
  // 编辑系统预设条目时不显示
  return !NO_PROMPT_ITEMS.includes(formData.value.id || '');
});

// 监听外部传入的 item 数据，用于编辑模式
watch(
  () => props.item,
  (newItem) => {
    if (props.mode === 'edit' && newItem) {
      formData.value = {
        name: newItem.name || '',
        description: newItem.description || '',
        prompt: newItem.prompt || '',
        roleType: newItem.roleType || 'system',
        id: newItem.id,
        enabled: newItem.enabled,
      };
    }
  },
  { immediate: true }
);

// 监听模态框打开状态
watch(
  () => props.show,
  (show) => {
    if (show) {
      // 打开时根据模式初始化表单
      if (props.mode === 'create') {
        formData.value = { name: '', description: '', prompt: '', roleType: 'system' };
      } else if (props.item) {
        formData.value = {
          name: props.item.name || '',
          description: props.item.description || '',
          prompt: props.item.prompt || '',
          roleType: props.item.roleType || 'system',
          id: props.item.id,
          enabled: props.item.enabled,
        };
      }
      formError.value = '';
      // 自动聚焦到名称输入框
      nextTick(() => {
        nameInputRef.value?.focus();
      });
    } else {
      // 关闭时重置表单和错误
      formData.value = { name: '', description: '', prompt: '', roleType: 'system' };
      formError.value = '';
    }
  }
);

const handleSave = () => {
  formError.value = '';

  // 验证表单
  if (!formData.value.name?.trim()) {
    formError.value = '请输入条目名称';
    nameInputRef.value?.focus();
    return;
  }
  if (!formData.value.description?.trim()) {
    formError.value = '请输入描述内容';
    return;
  }

  emit('save', {
    name: formData.value.name.trim(),
    description: formData.value.description.trim(),
    prompt: formData.value.prompt?.trim() || '',
    roleType: formData.value.roleType || 'system',
  });

  // 创建模式关闭模态框，编辑模式保持打开
  if (props.mode === 'create') {
    emit('update:show', false);
  }
};

const handleCancel = () => {
  formError.value = '';
  emit('update:show', false);
};

const handleNameKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    handleSave();
  }
};
</script>

<template>
  <Modal
    :show="show"
    :title="mode === 'create' ? '新建条目' : '编辑条目'"
    size="md"
    @update:show="emit('update:show', $event)"
  >
    <div class="form-group">
      <label class="form-label">名称 <span class="required">*</span></label>
      <FormInput
        ref="nameInputRef"
        v-model="formData.name"
        type="text"
        placeholder="输入条目名称"
        :error="!!formError && !formData.name?.trim()"
        @keydown="handleNameKeydown"
      />
    </div>
    <div class="form-group">
      <label class="form-label">描述 <span class="required">*</span></label>
      <FormTextarea
        v-model="formData.description"
        placeholder="输入描述内容"
        :rows="3"
        :error="!!formError && !formData.description?.trim()"
      />
    </div>
    <div v-if="shouldShowPrompt" class="form-group">
      <label class="form-label">角色类型</label>
      <div class="role-type-selector">
        <button
          :class="['role-type-btn', { 'role-type-btn--active': formData.roleType === 'system' }]"
          @click="formData.roleType = 'system'"
        >
          System
        </button>
        <button
          :class="['role-type-btn', { 'role-type-btn--active': formData.roleType === 'user' }]"
          @click="formData.roleType = 'user'"
        >
          User
        </button>
        <button
          :class="['role-type-btn', { 'role-type-btn--active': formData.roleType === 'assistant' }]"
          @click="formData.roleType = 'assistant'"
        >
          Assistant
        </button>
      </div>
    </div>
    <div v-if="shouldShowPrompt" class="form-group">
      <label class="form-label">提示词</label>
      <FormTextarea
        v-model="formData.prompt"
        placeholder="输入提示词内容（可选）"
        :rows="4"
      />
    </div>
    <div v-if="formError" class="form-error">
      {{ formError }}
    </div>
    <template #footer>
      <div class="modal-footer-actions">
        <button class="btn-secondary" @click="handleCancel">
          <X :size="16" />
          取消
        </button>
        <button
          class="btn-primary"
          :disabled="!canSave"
          @click="handleSave"
        >
          <Plus :size="16" />
          {{ mode === 'create' ? '添加' : '保存' }}
        </button>
      </div>
    </template>
  </Modal>
</template>

<style scoped>
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

.required {
  color: #ef4444;
  margin-left: 2px;
  font-weight: 400;
}

.role-type-selector {
  display: flex;
  gap: 8px;
}

.role-type-btn {
  flex: 1;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1.5px solid var(--border-color);
  background: var(--bg-primary);
  color: var(--text-muted);
  font-size: 13px;
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

.form-error {
  font-size: 12px;
  color: #ef4444;
  margin-top: 12px;
  padding: 10px 14px;
  background: rgba(239, 68, 68, 0.08);
  border-radius: 10px;
  border: 1px solid rgba(239, 68, 68, 0.15);
  line-height: 1.5;
  font-weight: 500;
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
</style>