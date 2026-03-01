<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { Plus, X, User, Bot } from 'lucide-vue-next';
import type { Theme, UserCharacter, AICharacter, CharacterType } from '../types';
import { DEFAULT_USER_CHARACTER, DEFAULT_AI_CHARACTERS, STORAGE_KEYS } from '../constants';
import { useConfirmDialog } from '../composables/useConfirmDialog';
import { useNotifications, getNotificationMessage } from '../modules/notification';
import { getStorage, setStorage } from '@/utils/storage';
import PageHeader from './common/PageHeader.vue';
import CharacterForm from './role/CharacterForm.vue';
import UserCharacterList from './role/UserCharacterList.vue';
import AICharacterList from './role/AICharacterList.vue';
import ConfirmDialog from './ConfirmDialog.vue';
import '../styles/role-management.css';

interface Props {
  theme: Theme;
}

const props = defineProps<Props>();

const router = useRouter();

// 使用确认对话框 composable
const { confirmDialogProps, showDeleteConfirm, confirmDelete, cancelDelete } = useConfirmDialog();

// 使用通知 composable
const { showSuccess, showInfo } = useNotifications();

// 角色类型标签页
const activeTab = ref<CharacterType>('user');

// 用户角色数据
const userCharacters = ref<UserCharacter[]>([]);
const selectedUserId = ref<string | null>(null);

// AI角色数据
const aiCharacters = ref<AICharacter[]>([]);

// 编辑状态
const editingId = ref<string | null>(null);
const editingType = ref<CharacterType | null>(null);
const editingCharacter = ref<Partial<UserCharacter | AICharacter>>({});
const showNewForm = ref(false);

// 当前正在删除的角色类型
const deleteTargetType = ref<CharacterType | null>(null);

// 加载用户角色
const loadUserCharacters = async () => {
  const stored = await getStorage<UserCharacter[]>(STORAGE_KEYS.USER_CHARACTERS, [DEFAULT_USER_CHARACTER]);
  userCharacters.value = stored;
};

// 加载AI角色
const loadAICharacters = async () => {
  const stored = await getStorage<AICharacter[]>(STORAGE_KEYS.AI_CHARACTERS, [...DEFAULT_AI_CHARACTERS]);
  aiCharacters.value = stored;
};

// 加载选中的用户角色
const loadSelectedUser = async () => {
  const stored = await getStorage<string>(STORAGE_KEYS.SELECTED_USER_CHARACTER, '');
  if (stored) {
    selectedUserId.value = stored;
  } else if (userCharacters.value.length > 0) {
    selectedUserId.value = userCharacters.value[0]?.id || null;
  }
};

// 保存用户角色
const saveUserCharacters = async () => {
  await setStorage(STORAGE_KEYS.USER_CHARACTERS, userCharacters.value);
};

// 保存AI角色
const saveAICharacters = async () => {
  await setStorage(STORAGE_KEYS.AI_CHARACTERS, aiCharacters.value);
};

// 保存选中的用户角色
const saveSelectedUser = async () => {
  if (selectedUserId.value) {
    await setStorage(STORAGE_KEYS.SELECTED_USER_CHARACTER, selectedUserId.value);
  }
};

// 选择用户角色
const selectUser = async (id: string) => {
  selectedUserId.value = id;
  await saveSelectedUser();
};

// 添加新角色
const addCharacter = async (character: UserCharacter | AICharacter) => {
  if (activeTab.value === 'user') {
    userCharacters.value.push(character as UserCharacter);
    await saveUserCharacters();
    const msg = getNotificationMessage('CHARACTER_ADD_USER_SUCCESS', { name: character.name });
    showSuccess(msg.title, msg.message);
    // 如果是第一个角色，自动选中
    if (userCharacters.value.length === 1) {
      selectedUserId.value = character.id;
      await saveSelectedUser();
    }
  } else {
    aiCharacters.value.push(character as AICharacter);
    await saveAICharacters();
    const msg = getNotificationMessage('CHARACTER_ADD_AI_SUCCESS', { name: character.name });
    showSuccess(msg.title, msg.message);
  }
  showNewForm.value = false;
};

// 取消新建角色
const cancelNewCharacter = () => {
  showNewForm.value = false;
};

// 开始编辑
const startEdit = (id: string, type: CharacterType) => {
  editingId.value = id;
  editingType.value = type;
  if (type === 'user') {
    const character = userCharacters.value.find(c => c.id === id);
    if (character) {
      editingCharacter.value = { ...character };
    }
  } else {
    const character = aiCharacters.value.find(c => c.id === id);
    if (character) {
      editingCharacter.value = { ...character, knowledgeBaseId: character.knowledgeBaseId };
    }
  }
};

// 保存编辑
const saveEdit = async () => {
  if (!editingId.value || !editingType.value || !editingCharacter.value.name) return;

  if (editingType.value === 'user') {
    const index = userCharacters.value.findIndex(c => c.id === editingId.value);
    if (index !== -1) {
      userCharacters.value[index] = {
        ...userCharacters.value[index],
        ...editingCharacter.value,
      } as UserCharacter;
      await saveUserCharacters();
      const msg = getNotificationMessage('CHARACTER_UPDATE_USER_SUCCESS', { name: editingCharacter.value.name });
      showSuccess(msg.title, msg.message);
    }
  } else {
    const index = aiCharacters.value.findIndex(c => c.id === editingId.value);
    if (index !== -1) {
      const editingKBId = (editingCharacter.value as AICharacter).knowledgeBaseId;
      const updates: Partial<AICharacter> = {
        ...editingCharacter.value,
      };
      // 只在 editingCharacter 中有明确设置 knowledgeBaseId 时才更新
      // 避免意外清除原有的知识库绑定
      if (editingKBId !== undefined) {
        updates.knowledgeBaseId = editingKBId;
      }
      aiCharacters.value[index] = {
        ...aiCharacters.value[index],
        ...updates,
      } as AICharacter;
      await saveAICharacters();
      const msg = getNotificationMessage('CHARACTER_UPDATE_AI_SUCCESS', { name: editingCharacter.value.name });
      showSuccess(msg.title, msg.message);
    }
  }
  editingId.value = null;
  editingType.value = null;
  editingCharacter.value = {};
};

// 取消编辑
const cancelEdit = () => {
  editingId.value = null;
  editingType.value = null;
  editingCharacter.value = {};
};

// 删除角色
const deleteCharacter = (id: string, type: CharacterType) => {
  deleteTargetType.value = type;
  if (type === 'user') {
    const character = userCharacters.value.find(c => c.id === id);
    showDeleteConfirm(id, character?.name || '', '角色');
  } else {
    const character = aiCharacters.value.find(c => c.id === id);
    showDeleteConfirm(id, character?.name || '', '角色');
  }
};

// 确认删除
const handleConfirmDelete = async () => {
  const id = confirmDelete();
  if (!id || !deleteTargetType.value) return;

  const type = deleteTargetType.value;

  if (type === 'user') {
    // 如果删除的是选中的用户角色，选中第一个
    if (id === selectedUserId.value) {
      const remaining = userCharacters.value.filter(c => c.id !== id);
      if (remaining.length > 0) {
        selectedUserId.value = remaining[0]?.id || null;
        await saveSelectedUser();
      } else {
        selectedUserId.value = null;
      }
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

// 处理返回按钮点击
const handleBack = () => {
  if (showNewForm.value) {
    showNewForm.value = false;
  } else if (editingId.value) {
    cancelEdit();
  } else {
    router.back();
  }
};

onMounted(async () => {
  await loadUserCharacters();
  await loadAICharacters();
  await loadSelectedUser();
});
</script>

<template>
  <div class="role-management-page">
    <!-- 顶部导航栏 -->
    <PageHeader
      title="角色管理"
      subtitle="Characters"
      :show-action="!showNewForm"
      :action-icon="Plus"
      @back="handleBack"
      @action="showNewForm = true"
    >
      <template #extra>
        <button class="nav-btn" @click="showNewForm = false" v-if="showNewForm">
          <X :size="22" />
        </button>
      </template>
    </PageHeader>

    <!-- 标签页切换 -->
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

    <!-- 滚动内容区域 -->
    <div class="content-scroll">
      <!-- 新建角色表单 -->
      <CharacterForm
        v-if="showNewForm"
        :type="activeTab"
        @submit="addCharacter"
        @cancel="cancelNewCharacter"
      />

      <!-- 用户角色列表 -->
      <UserCharacterList
        v-if="activeTab === 'user'"
        :characters="userCharacters"
        :selected-user-id="selectedUserId"
        :editing-id="editingId"
        :editing-data="editingCharacter"
        @select="selectUser"
        @start-edit="startEdit"
        @save-edit="saveEdit"
        @cancel-edit="cancelEdit"
        @delete="deleteCharacter"
      />

      <!-- AI角色列表 -->
      <AICharacterList
        v-if="activeTab === 'ai'"
        :characters="aiCharacters"
        :editing-id="editingId"
        :editing-data="editingCharacter"
        @start-edit="startEdit"
        @save-edit="saveEdit"
        @cancel-edit="cancelEdit"
        @delete="deleteCharacter"
      />
    </div>

    <!-- 删除确认对话框 -->
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

.nav-btn {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  border: none;
  background: transparent;
  color: var(--text-main);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  flex-shrink: 0;
}

.nav-btn:active {
  transform: scale(0.9);
  background: var(--accent-soft);
}
</style>