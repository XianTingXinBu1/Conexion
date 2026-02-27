<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import type { UserCharacter, AICharacter, CharacterType, KnowledgeBase } from '../../types';
import { STORAGE_KEYS } from '../../constants';
import { getStorage } from '@/utils/storage';
import FormInput from '../form/FormInput.vue';
import FormTextarea from '../form/FormTextarea.vue';
import FormActions from '../form/FormActions.vue';

interface Props {
  type: CharacterType;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  submit: [character: UserCharacter | AICharacter];
  cancel: [];
}>();

const knowledgeBases = ref<KnowledgeBase[]>([]);

const formData = ref<Partial<UserCharacter | AICharacter> & { name: string; description: string }>({
  name: '',
  description: '',
  knowledgeBaseId: undefined,
});

// 安全访问 personality 字段
const personality = computed({
  get: () => (formData.value as Partial<AICharacter>).personality || '',
  set: (value: string) => {
    (formData.value as Partial<AICharacter>).personality = value;
  },
});

// 安全访问 knowledgeBaseId 字段
const knowledgeBaseId = computed({
  get: () => (formData.value as Partial<AICharacter>).knowledgeBaseId,
  set: (value: string | undefined) => {
    (formData.value as Partial<AICharacter>).knowledgeBaseId = value;
  },
});

// 加载知识库列表
const loadKnowledgeBases = async () => {
  const stored = await getStorage<KnowledgeBase[]>(STORAGE_KEYS.KNOWLEDGE_BASES, []);
  knowledgeBases.value = stored;
};

const title = computed(() => {
  return props.type === 'user' ? '新建用户角色' : '新建AI角色';
});

const namePlaceholder = computed(() => {
  return props.type === 'user' ? '例如：小明' : '例如：智能助手';
});

const descriptionPlaceholder = computed(() => {
  return props.type === 'user' ? '描述用户的基本信息' : '描述AI角色的基本设定';
});

const handleSubmit = () => {
  const trimmedName = formData.value.name?.trim();
  if (!trimmedName) return;

  const character: UserCharacter | AICharacter = {
    id: Date.now().toString(),
    name: trimmedName,
    description: formData.value.description || '',
    createdAt: Date.now(),
  };

  if (props.type === 'ai') {
    (character as AICharacter).personality = (formData.value as AICharacter).personality || '';
    (character as AICharacter).knowledgeBaseId = (formData.value as AICharacter).knowledgeBaseId;
  }

  emit('submit', character);
  resetFormData();
};

const handleCancel = () => {
  resetFormData();
  emit('cancel');
};

const resetFormData = () => {
  formData.value = {
    name: '',
    description: '',
    personality: '',
    knowledgeBaseId: undefined,
  };
};

const canSubmit = computed(() => {
  return formData.value.name?.trim();
});

onMounted(async () => {
  await loadKnowledgeBases();
});
</script>

<template>
  <div class="character-form">
    <div class="character-form__title">{{ title }}</div>
    <div class="character-form__body">
      <FormInput
        v-model="formData.name"
        label="角色名称"
        type="text"
        :placeholder="namePlaceholder"
      />
      <FormTextarea
        v-model="formData.description"
        label="角色描述"
        :placeholder="descriptionPlaceholder"
        :rows="3"
      />
      <FormTextarea
        v-if="type === 'ai'"
        v-model="personality"
        label="个性描述"
        placeholder="描述AI角色的性格特点"
        :rows="3"
      />
      <div v-if="type === 'ai' && knowledgeBases.length > 0" class="form-group">
        <label class="form-label">绑定知识库</label>
        <select
          v-model="knowledgeBaseId"
          class="form-select"
        >
          <option value="">不绑定知识库</option>
          <option
            v-for="kb in knowledgeBases"
            :key="kb.id"
            :value="kb.id"
          >
            {{ kb.name }} {{ kb.globallyEnabled ? '(全局启用)' : '' }}
          </option>
        </select>
      </div>
    </div>
    <FormActions
      :buttons="[
        { type: 'secondary', label: '取消' },
        { type: 'primary', label: '添加', disabled: !canSubmit },
      ]"
      :equal-width="true"
      @click="(_, index) => index === 1 ? handleSubmit() : handleCancel()"
    />
  </div>
</template>

<style scoped>
.character-form {
  background: var(--bg-secondary);
  border-radius: 12px;
  padding: 16px;
  border: 1px solid var(--accent-purple);
  margin-bottom: 20px;
}

.character-form__title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-muted);
  margin-bottom: 14px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.character-form__body {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-bottom: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-label {
  font-size: 13px;
  color: var(--text-muted);
  font-weight: 500;
}

.form-select {
  padding: 12px 14px;
  border-radius: 10px;
  border: 1.5px solid var(--border-color);
  background: var(--bg-primary);
  color: var(--text-main);
  font-size: 14px;
  transition: all 0.2s ease;
  outline: none;
}

.form-select:focus {
  border-color: var(--accent-purple);
  box-shadow: 0 0 0 3px rgba(157, 141, 241, 0.1);
}

.form-select:active {
  transform: scale(0.99);
}
</style>