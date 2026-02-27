<script setup lang="ts">
import { computed, ref, onMounted } from 'vue';
import { User, Bot, Check, Edit2, Trash2, X } from 'lucide-vue-next';
import type { UserCharacter, AICharacter, CharacterType, KnowledgeBase } from '../../types';
import { STORAGE_KEYS } from '../../constants';
import { getStorage } from '@/utils/storage';
import FormInput from '../form/FormInput.vue';
import FormTextarea from '../form/FormTextarea.vue';
import FormActions from '../form/FormActions.vue';

interface Props {
  character: UserCharacter | AICharacter;
  type: CharacterType;
  isSelected?: boolean;
  isEditing: boolean;
  editingData?: Partial<UserCharacter | AICharacter>;
  canDelete?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  isSelected: false,
  isEditing: false,
  canDelete: true,
});

const knowledgeBases = ref<KnowledgeBase[]>([]);

// 加载知识库列表
const loadKnowledgeBases = async () => {
  const stored = await getStorage<KnowledgeBase[]>(STORAGE_KEYS.KNOWLEDGE_BASES, []);
  knowledgeBases.value = stored;
};

onMounted(async () => {
  await loadKnowledgeBases();
});

const emit = defineEmits<{
  select: [id: string];
  startEdit: [id: string, type: CharacterType];
  saveEdit: [];
  cancelEdit: [];
  delete: [id: string, type: CharacterType];
}>();

const cardClasses = computed(() => [
  'character-card',
  {
    'character-card--selected': props.isSelected,
    'character-card--editing': props.isEditing,
  },
]);

const selectBtnClasses = computed(() => [
  'select-btn',
  { 'select-btn--active': props.isSelected },
]);

const avatarClasses = computed(() => [
  'character-avatar',
  { 'character-avatar--ai': props.type === 'ai' },
]);

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

const updatePersonality = (value: string | undefined) => {
  if (props.editingData && 'personality' in props.editingData) {
    (props.editingData as AICharacter).personality = value ?? '';
  }
};

// 计算是否可以保存
const canSave = computed(() => {
  return props.editingData?.name?.trim();
});

// 获取绑定的知识库名称
const boundKnowledgeBaseName = computed(() => {
  if (props.type !== 'ai') return null;

  // 首先检查角色是否有明确绑定的知识库
  const kbId = (props.character as AICharacter).knowledgeBaseId;
  if (kbId) {
    const kb = knowledgeBases.value.find(k => k.id === kbId);
    return kb?.name || null;
  }

  // 如果没有明确绑定，检查是否有全局启用的知识库
  const globalKb = knowledgeBases.value.find(k => k.globallyEnabled);
  return globalKb?.name || null;
});

// 获取知识库绑定类型
const knowledgeBindingType = computed(() => {
  if (props.type !== 'ai') return null;

  const kbId = (props.character as AICharacter).knowledgeBaseId;
  if (kbId) {
    return 'explicit'; // 明确绑定
  }

  const globalKb = knowledgeBases.value.find(k => k.globallyEnabled);
  if (globalKb) {
    return 'global'; // 全局启用
  }

  return null;
});

// 获取编辑中的 knowledgeBaseId
const editingKnowledgeBaseId = computed({
  get: () => {
    if (props.type !== 'ai' || !props.editingData) return undefined;
    return (props.editingData as AICharacter).knowledgeBaseId;
  },
  set: (value: string | undefined) => {
    if (props.type === 'ai' && props.editingData) {
      (props.editingData as AICharacter).knowledgeBaseId = value;
    }
  },
});
</script>

<template>
  <div :class="cardClasses">
    <!-- 查看模式 -->
    <template v-if="!isEditing">
      <div class="character-header">
        <div class="character-info">
          <button
            v-if="type === 'user'"
            :class="selectBtnClasses"
            @click="emit('select', character.id)"
          >
            <Check v-if="isSelected" :size="16" />
          </button>
          <div :class="avatarClasses">
            <component :is="type === 'user' ? User : Bot" :size="20" />
          </div>
          <div class="character-name">{{ character.name }}</div>
        </div>
        <div class="character-actions">
          <button class="action-btn" @click="emit('startEdit', character.id, type)">
            <Edit2 :size="16" />
          </button>
          <button
            class="action-btn action-btn--delete"
            :disabled="!canDelete"
            @click="emit('delete', character.id, type)"
          >
            <Trash2 :size="16" />
          </button>
        </div>
      </div>
      <div class="character-body">
        <div class="character-detail">
          <span class="detail-label">描述:</span>
          <span class="detail-value">{{ character.description || '暂无描述' }}</span>
        </div>
        <div v-if="type === 'ai' && 'personality' in character && character.personality" class="character-detail">
          <span class="detail-label">个性:</span>
          <span class="detail-value">{{ character.personality }}</span>
        </div>
        <div v-if="type === 'ai' && boundKnowledgeBaseName" class="character-detail">
          <span class="detail-label">知识库:</span>
          <span class="detail-value">
            {{ boundKnowledgeBaseName }}
            <span v-if="knowledgeBindingType === 'global'" class="binding-tag binding-tag--global">全局</span>
            <span v-if="knowledgeBindingType === 'explicit'" class="binding-tag binding-tag--explicit">绑定</span>
          </span>
        </div>
      </div>
    </template>

    <!-- 编辑模式 -->
    <template v-else>
      <div class="edit-form">
        <div class="form-group">
          <label class="form-label">角色名称</label>
          <FormInput
            :model-value="editingData?.name || ''"
            type="text"
            placeholder="角色名称"
            @update:model-value="updateName"
          />
        </div>
        <div class="form-group">
          <label class="form-label">角色描述</label>
          <FormTextarea
            :model-value="editingData?.description || ''"
            placeholder="角色描述"
            :rows="2"
            @update:model-value="updateDescription"
          />
        </div>
        <div v-if="type === 'ai'" class="form-group">
          <label class="form-label">个性描述</label>
          <FormTextarea
            :model-value="(editingData as AICharacter)?.personality || ''"
            placeholder="个性描述"
            :rows="2"
            @update:model-value="updatePersonality"
          />
        </div>
        <div v-if="type === 'ai' && knowledgeBases.length > 0" class="form-group">
          <label class="form-label">绑定知识库</label>
          <select
            :value="editingKnowledgeBaseId || ''"
            class="form-select"
            @change="editingKnowledgeBaseId = ($event.target as HTMLSelectElement).value || undefined"
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
.character-card {
  background: var(--bg-secondary);
  border-radius: 12px;
  border: 1px solid var(--border-color);
  overflow: hidden;
  transition: all 0.2s ease;
}

.character-card--selected {
  border-color: var(--accent-purple);
  box-shadow: 0 0 0 2px rgba(157, 141, 241, 0.1);
}

.character-card--editing {
  border-color: var(--accent-purple);
  box-shadow: 0 0 0 2px rgba(157, 141, 241, 0.1);
}

.character-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px;
  border-bottom: 1px solid var(--border-color);
}

.character-info {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.select-btn {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  border: 1.5px solid var(--border-color);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.select-btn--active {
  background: var(--accent-purple);
  border-color: var(--accent-purple);
  color: white;
}

.select-btn:active {
  transform: scale(0.9);
}

.character-avatar {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: var(--accent-soft);
  color: var(--accent-purple);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.character-avatar--ai {
  background: rgba(16, 185, 129, 0.15);
  color: #10b981;
}

.character-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-main);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.character-actions {
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

.action-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.action-btn:active:not(:disabled) {
  transform: scale(0.9);
  background: var(--accent-soft);
}

.action-btn--delete:active:not(:disabled) {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.character-body {
  padding: 12px 14px;
}

.character-detail {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.detail-label {
  font-size: 12px;
  color: var(--text-muted);
  font-weight: 500;
}

.detail-value {
  font-size: 13px;
  color: var(--text-main);
  line-height: 1.5;
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  word-break: break-all;
}

.binding-tag {
  display: inline-flex;
  align-items: center;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
  margin-left: 6px;
  letter-spacing: 0.3px;
}

.binding-tag--global {
  background: rgba(16, 185, 129, 0.15);
  color: #10b981;
}

.binding-tag--explicit {
  background: rgba(157, 141, 241, 0.2);
  color: var(--accent-purple);
}

.edit-form {
  padding: 14px;
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

.form-select {
  padding: 10px 12px;
  border-radius: 10px;
  border: 1.5px solid var(--border-color);
  background: var(--bg-primary);
  color: var(--text-main);
  font-size: 13px;
  transition: all 0.2s ease;
  outline: none;
  width: 100%;
}

.form-select:focus {
  border-color: var(--accent-purple);
  box-shadow: 0 0 0 3px rgba(157, 141, 241, 0.1);
}

.form-select:active {
  transform: scale(0.99);
}
</style>