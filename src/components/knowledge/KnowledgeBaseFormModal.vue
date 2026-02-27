<script setup lang="ts">
import { ref, watch } from 'vue';
import type { KnowledgeBase } from '../../types';
import Modal from '../common/Modal.vue';
import FormInput from '../form/FormInput.vue';
import FormTextarea from '../form/FormTextarea.vue';
import FormActions from '../form/FormActions.vue';
import { X } from 'lucide-vue-next';

interface Props {
  show: boolean;
  mode: 'create' | 'edit';
  knowledgeBase?: Partial<KnowledgeBase>;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  'update:show': [value: boolean];
  save: [data: { name: string; description: string }];
}>();

const formData = ref({
  name: '',
  description: '',
});

const canSave = ref(false);

watch(
  () => props.show,
  (show) => {
    if (show) {
      if (props.mode === 'edit' && props.knowledgeBase) {
        formData.value.name = props.knowledgeBase.name || '';
        formData.value.description = props.knowledgeBase.description || '';
      } else {
        formData.value.name = '';
        formData.value.description = '';
      }
    }
  }
);

watch(
  formData,
  (data) => {
    canSave.value = data.name.trim().length > 0;
  },
  { deep: true }
);

const handleSave = () => {
  if (canSave.value) {
    emit('save', {
      name: formData.value.name.trim(),
      description: formData.value.description.trim(),
    });
  }
};

const handleClose = () => {
  emit('update:show', false);
};
</script>

<template>
  <Modal :show="show" @close="handleClose">
    <div class="kb-form-modal">
      <div class="modal-header">
        <h2 class="modal-title">{{ mode === 'create' ? '新建知识库' : '编辑知识库' }}</h2>
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
            placeholder="输入知识库名称"
          />
        </div>

        <div class="form-group">
          <label class="form-label">描述</label>
          <FormTextarea
            v-model="formData.description"
            placeholder="输入知识库描述（可选）"
            :rows="3"
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
.kb-form-modal {
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

.modal-footer {
  padding: 16px 24px 24px;
}
</style>