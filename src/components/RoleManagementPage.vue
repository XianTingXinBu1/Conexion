<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useBackGuard } from '@/composables/useBackGuard';
import Modal from './common/Modal.vue';
import { useRouter } from 'vue-router';
import { Plus, User, Bot, Upload } from '@lucide/vue';
import type { UserCharacter, AICharacter, CharacterType } from '@/types';
import { useConfirmDialog } from '../composables/useConfirmDialog';
import { useNotifications, getNotificationMessage } from '../modules/notification';
import {
  parseCharacterImport,
  serializeCharacterCard,
  toSafeFileName,
  CharacterCardParseError,
} from '@/modules/character-card';
import type { ImportedCharacter } from '@/modules/character-card';
import { loadKnowledgeBases } from '@/repositories/knowledgeBaseRepository';
import { downloadTextFile, readFileAsText } from '@/utils/download';
import {
  loadAICharacters as loadAICharactersFromRepository,
  loadSelectedUserCharacterId,
  loadUserCharacters as loadUserCharactersFromRepository,
  saveAICharacters as saveAICharactersToRepository,
  saveSelectedUserCharacterId,
  saveUserCharacters as saveUserCharactersToRepository,
} from '@/repositories/characterRepository';
import PageHeader from './common/PageHeader.vue';
import CharacterEditor from './role/CharacterEditor.vue';
import UserCharacterList from './role/UserCharacterList.vue';
import AICharacterList from './role/AICharacterList.vue';
import ConfirmDialog from '@/components/common/ConfirmDialog.vue';
import '../styles/role-management.css';

const router = useRouter();

const { confirmDialogProps, showDeleteConfirm, confirmDelete, cancelDelete } = useConfirmDialog();
const { showSuccess, showInfo, showError } = useNotifications();

const activeTab = ref<CharacterType>('user');

const userCharacters = ref<UserCharacter[]>([]);
const selectedUserId = ref<string | null>(null);
const aiCharacters = ref<AICharacter[]>([]);

const deleteTargetType = ref<CharacterType | null>(null);

// 编辑器状态：editingCharacter 为空表示新建
const isCreateOpen = ref(false);
const isImporting = ref(false);
const isEditorOpen = ref(false);
const editorCharacter = ref<UserCharacter | AICharacter | null>(null);

const importInput = ref<HTMLInputElement | null>(null);

// 创建方式弹窗与编辑器共用一条历史记录，切换时不回退 / 重建占位记录。
useBackGuard({
  isOpen: () => isCreateOpen.value || isEditorOpen.value,
  onBack: () => {
    isCreateOpen.value = false;
    isEditorOpen.value = false;
    editorCharacter.value = null;
  },
});

const loadUserCharacters = async () => {
  userCharacters.value = await loadUserCharactersFromRepository();
};

const loadAICharacters = async () => {
  aiCharacters.value = await loadAICharactersFromRepository();
};

const loadSelectedUser = async () => {
  const stored = await loadSelectedUserCharacterId();
  if (stored) {
    selectedUserId.value = stored;
  } else if (userCharacters.value.length > 0) {
    selectedUserId.value = userCharacters.value[0]?.id || null;
  }
};

const saveUserCharacters = async () => {
  await saveUserCharactersToRepository(userCharacters.value);
};

const saveAICharacters = async () => {
  await saveAICharactersToRepository(aiCharacters.value);
};

const saveSelectedUser = async () => {
  if (selectedUserId.value) {
    await saveSelectedUserCharacterId(selectedUserId.value);
  }
};

const selectUser = async (id: string) => {
  selectedUserId.value = id;
  await saveSelectedUser();
};

// ==================== 新建 / 编辑 ====================

const openCreateEditor = () => {
  isCreateOpen.value = false;
  editorCharacter.value = null;
  isEditorOpen.value = true;
};

const openEditEditor = (id: string) => {
  const source = activeTab.value === 'user' ? userCharacters.value : aiCharacters.value;
  const character = source.find(item => item.id === id);
  if (!character) return;

  editorCharacter.value = character;
  isEditorOpen.value = true;
};

const closeEditor = () => {
  isEditorOpen.value = false;
  editorCharacter.value = null;
};

const handleEditorSubmit = async (character: UserCharacter | AICharacter) => {
  const isNew = !editorCharacter.value;

  if (activeTab.value === 'user') {
    const next = character as UserCharacter;

    if (isNew) {
      userCharacters.value.push(next);
      if (userCharacters.value.length === 1) {
        selectedUserId.value = next.id;
        await saveSelectedUser();
      }
    } else {
      const index = userCharacters.value.findIndex(item => item.id === next.id);
      if (index !== -1) userCharacters.value[index] = next;
    }

    await saveUserCharacters();
    const msg = getNotificationMessage(
      isNew ? 'CHARACTER_ADD_USER_SUCCESS' : 'CHARACTER_UPDATE_USER_SUCCESS',
      { name: next.name },
    );
    showSuccess(msg.title, msg.message);
  } else {
    const next = character as AICharacter;

    if (isNew) {
      aiCharacters.value.push(next);
    } else {
      const index = aiCharacters.value.findIndex(item => item.id === next.id);
      if (index !== -1) aiCharacters.value[index] = next;
    }

    await saveAICharacters();
    const msg = getNotificationMessage(
      isNew ? 'CHARACTER_ADD_AI_SUCCESS' : 'CHARACTER_UPDATE_AI_SUCCESS',
      { name: next.name },
    );
    showSuccess(msg.title, msg.message);
  }

  closeEditor();
};

// ==================== 删除 ====================

const deleteCharacter = (id: string) => {
  deleteTargetType.value = activeTab.value;
  const source = activeTab.value === 'user' ? userCharacters.value : aiCharacters.value;
  const character = source.find(item => item.id === id);
  showDeleteConfirm(id, character?.name || '', '角色');
};

const handleConfirmDelete = async () => {
  const id = confirmDelete();
  if (!id || !deleteTargetType.value) return;

  if (deleteTargetType.value === 'user') {
    if (id === selectedUserId.value) {
      const remaining = userCharacters.value.filter(c => c.id !== id);
      selectedUserId.value = remaining[0]?.id ?? null;
      await saveSelectedUser();
    }
    userCharacters.value = userCharacters.value.filter(c => c.id !== id);
    await saveUserCharacters();
    const msg = getNotificationMessage('CHARACTER_DELETE_USER_SUCCESS');
    showInfo(msg.title, msg.message);
  } else {
    aiCharacters.value = aiCharacters.value.filter(c => c.id !== id);
    await saveAICharacters();
    const msg = getNotificationMessage('CHARACTER_DELETE_AI_SUCCESS');
    showInfo(msg.title, msg.message);
  }

  deleteTargetType.value = null;
};

// ==================== 导入 / 导出 ====================

const handleExportOne = (id: string) => {
  const character = aiCharacters.value.find(item => item.id === id);
  if (!character) return;

  downloadTextFile(toSafeFileName(character.name), serializeCharacterCard(character));
  const msg = getNotificationMessage('CHARACTER_EXPORT_SUCCESS', { count: 1 });
  showSuccess(msg.title, msg.message);
};

const handleImportClick = () => {
  importInput.value?.click();
};

/**
 * 转成本地角色：一律分配新 id（导入是新增而不是覆盖），
 * 并丢掉指向已不存在知识库的绑定。
 */
const toLocalCharacters = (imported: ImportedCharacter[], validKnowledgeBaseIds: Set<string>): AICharacter[] => {
  const now = Date.now();

  return imported.map((item, index) => ({
    ...item,
    id: `imported-${now}-${index}`,
    createdAt: now,
    knowledgeBaseId: item.knowledgeBaseId && validKnowledgeBaseIds.has(item.knowledgeBaseId)
      ? item.knowledgeBaseId
      : undefined,
  }));
};

const handleImportFile = async (event: Event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';

  if (!file || isImporting.value) return;

  isImporting.value = true;
  try {
    const text = await readFileAsText(file);
    const imported = parseCharacterImport(text);

    const knowledgeBases = await loadKnowledgeBases();
    const validIds = new Set(knowledgeBases.map(kb => kb.id));

    const nextCharacters = toLocalCharacters(imported, validIds);
    await saveAICharactersToRepository([...aiCharacters.value, ...nextCharacters]);
    aiCharacters.value.push(...nextCharacters);
    isCreateOpen.value = false;

    const msg = getNotificationMessage('CHARACTER_IMPORT_SUCCESS', { count: nextCharacters.length });
    showSuccess(msg.title, msg.message);
    activeTab.value = 'ai';
  } catch (error) {
    const reason = error instanceof CharacterCardParseError || error instanceof Error
      ? error.message
      : '文件格式无法识别';
    const msg = getNotificationMessage('CHARACTER_IMPORT_FAILED', { reason });
    showError(msg.title, msg.message);
  } finally {
    isImporting.value = false;
  }
};

const handleBack = () => {
  router.back();
};

onMounted(async () => {
  await loadUserCharacters();
  await loadAICharacters();
  await loadSelectedUser();
});
</script>

<template>
  <div class="role-management-page">
    <PageHeader
      title="角色管理"
      subtitle="Characters"
      :show-action="!isEditorOpen && !isCreateOpen"
      :action-icon="Plus"
      @back="handleBack"
      @action="isCreateOpen = true"
    />

    <div class="tabs-container">
      <button
        :class="['tab-btn', { 'active': activeTab === 'user' }]"
        @click="activeTab = 'user'"
      >
        <User :size="18" />
        <span>用户角色</span>
      </button>
      <button
        :class="['tab-btn', { 'active': activeTab === 'ai' }]"
        @click="activeTab = 'ai'"
      >
        <Bot :size="18" />
        <span>AI角色</span>
      </button>
    </div>

    <Modal
      :show="isCreateOpen"
      :guard-back="false"
      :title="activeTab === 'ai' ? '新建 AI 角色' : '新建用户角色'"
      size="sm"
      @update:show="isCreateOpen = false"
    >
      <div class="create-options">
        <button class="create-option" :disabled="isImporting" data-testid="create-character-manually" @click="openCreateEditor">
          <Plus :size="20" />
          <span>从空白创建</span>
        </button>
        <button v-if="activeTab === 'ai'" class="create-option" :disabled="isImporting" @click="handleImportClick">
          <Upload :size="20" />
          <span>{{ isImporting ? '导入中…' : '导入角色卡' }}</span>
        </button>
      </div>
    </Modal>
    <input
      ref="importInput"
      class="toolbar-file-input"
      type="file"
      accept=".json,application/json"
      data-testid="character-import-input"
      @change="handleImportFile"
    />

    <div class="content-scroll">
      <UserCharacterList
        v-if="activeTab === 'user'"
        :characters="userCharacters"
        :selected-user-id="selectedUserId"
        @select="selectUser"
        @edit="openEditEditor"
        @delete="deleteCharacter"
      />

      <AICharacterList
        v-else
        :characters="aiCharacters"
        @edit="openEditEditor"
        @delete="deleteCharacter"
        @export="handleExportOne"
      />
    </div>

    <CharacterEditor
      :show="isEditorOpen"
      :guard-back="false"
      :type="activeTab"
      :character="editorCharacter"
      @submit="handleEditorSubmit"
      @cancel="closeEditor"
    />

    <ConfirmDialog
      v-bind="confirmDialogProps"
      @confirm="handleConfirmDelete"
      @cancel="cancelDelete"
    />
  </div>
</template>

<style scoped>
.role-management-page {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
  overflow: hidden;
}

.create-options {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.create-option {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 14px;
  border-radius: 10px;
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
  color: var(--text-muted);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.create-option:active:not(:disabled) {
  transform: scale(0.96);
  background: var(--accent-soft);
  color: var(--accent-purple);
}

.toolbar-file-input {
  display: none;
}
</style>
