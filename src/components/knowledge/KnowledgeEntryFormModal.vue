<script setup lang="ts">
import { ref, watch } from 'vue';
import type { KnowledgeEntry } from '../../types';
import Modal from '../common/Modal.vue';
import FormInput from '../form/FormInput.vue';
import FormTextarea from '../form/FormTextarea.vue';
import FormActions from '../form/FormActions.vue';
import { X } from 'lucide-vue-next';

interface Props {
  show: boolean;
  mode: 'create' | 'edit';
  entry?: Partial<KnowledgeEntry>;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  'update:show': [value: boolean];
  save: [data: { name: string; content: string; priority: number }];
}>();

const formData = ref({
  name: '',
  content: '',
  priority: 50,
});

const canSave = ref(false);

watch(
  () => props.show,
  (show) => {
    if (show) {
      if (props.mode === 'edit' && props.entry) {
        formData.value.name = props.entry.name || '';
        formData.value.content = props.entry.content || '';
        formData.value.priority = props.entry.priority ?? 50;
      } else {
        formData.value.name = '';
        formData.value.content = '';
        formData.value.priority = 50;
      }
    }
  }
);

watch(
  formData,
  (data) => {
    canSave.value = data.name.trim().length > 0 && data.content.trim().length > 0;
  },
  { deep: true }
);

const handleSave = () => {
  if (canSave.value) {
    emit('save', {
      name: formData.value.name.trim(),
      content: formData.value.content.trim(),
      priority: formData.value.priority,
    });
  }
};

const handleClose = () => {
  emit('update:show', false);
};
</script>

<template>
  <Modal :show="show" @close="handleClose">
    <div class="entry-form-modal">
      <div class="modal-header">
        <h2 class="modal-title">{{ mode === 'create' ? '新建知识条目' : '编辑知识条目' }}</h2>
        <button class="close-btn" @click="handleClose">
          <X :size="20" />
        </button>
      </div>

      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">名称 *</label>
          <FormInput
            v-model="formData.name"
            type="text"
            placeholder="输入条目名称"
          />
        </div>

        <div class="form-group">
          <label class="form-label">优先级 (1-100) *</label>
          <FormInput
            :model-value="formData.priority"
            type="number"
            :min="1"
            :max="100"
            placeholder="50"
            @update:model-value="(value) => {
              const numValue = typeof value === 'number' ? value : (typeof value === 'string' && value ? parseFloat(value) : 50);
              formData.priority = isNaN(numValue) ? 50 : numValue;
            }"
          />
          <div class="form-hint">数字越小优先级越高，在构建提示词时会按优先级排序</div>
        </div>

        <div class="form-group">
          <label class="form-label">内容 *</label>
          <FormTextarea
            v-model="formData.content"
            placeholder="输入条目内容"
            :rows="5"
          />
        </div>
      </div>

      <div class="modal-footer">
        <FormActions
          :buttons="[
            { type: 'secondary', label: '取消', icon: X },
            { type: 'primary', label: '保存', icon: null, disabled: !canSave },
          ]"
          :equal-width="true"
          @click="(_, index) => index === 1 ? handleSave() : handleClose()"
        />
      </div>
    </div>
  </Modal>
</template>

<style scoped>
.entry-form-modal {
  width: 100%;
  max-width: 400px;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid var(--border-color);
}

.modal-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-main);
  margin: 0;
}

.close-btn {
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

.close-btn:active {
  transform: scale(0.9);
  background: var(--accent-soft);
}

.modal-body {
  padding: 24px;
}

.form-group {
  margin-bottom: 20px;
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

.form-hint {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 4px;
  opacity: 0.7;
}

.modal-footer {
  padding: 16px 24px 24px;
}
</style>