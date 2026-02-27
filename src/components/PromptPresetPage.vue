<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import type { Theme, PromptPreset, PromptItem } from '../types';
import { STORAGE_KEYS, DEFAULT_PROMPT_PRESETS, DEFAULT_PROMPT_ITEMS } from '../constants';
import { useConfirmDialog } from '../composables/useConfirmDialog';
import { useNotifications, getNotificationMessage } from '../modules/notification';
import { getStorage, setStorage } from '@/utils/storage';
import PresetHeader from './prompt/PresetHeader.vue';
import PromptMenu from './prompt/PromptMenu.vue';
import PromptItemList from './prompt/PromptItemList.vue';
import PromptFormModal from './prompt/PromptFormModal.vue';
import ConfirmDialog from './ConfirmDialog.vue';

interface Props {
  theme: Theme;
}

defineProps<Props>();

const emit = defineEmits<{
  back: [];
}>();

// 使用确认对话框 composable
const { confirmDialogProps, showDeleteConfirm, confirmDelete, cancelDelete } = useConfirmDialog();

// 使用通知 composable
const { showSuccess, showInfo } = useNotifications();

// 删除目标类型：'preset' 或 'item'
const deleteTargetType = ref<'preset' | 'item'>('preset');

// 预设列表
const presets = ref<PromptPreset[]>([]);
const selectedPresetId = ref<string>('default');

// 当前预设的条目列表
const promptItems = ref<PromptItem[]>([]);

// 预设管理相关
const showPresetMenu = ref(false);
const showNewItemForm = ref(false);

// 条目编辑相关
const editingId = ref<string | null>(null);
const editingItem = ref<Partial<PromptItem>>({});
const newItem = ref<Partial<PromptItem>>({
  name: '',
  description: '',
  prompt: '',
  roleType: 'system',
});

// 拖拽状态
const isDragging = ref(false);

// 计算属性：当前预设名称
const currentPresetName = computed(() => {
  return presets.value.find(p => p.id === selectedPresetId.value)?.name || '选择预设';
});

// 计算属性：已启用条目数量
const enabledCount = computed(() => promptItems.value.filter(i => i.enabled).length);

// 保存当前预设的条目
const saveCurrentPresetItems = async () => {
  const index = presets.value.findIndex(p => p.id === selectedPresetId.value);
  if (index !== -1 && presets.value[index]) {
    const itemsWithUpdatedPosition = promptItems.value.map((item, idx) => ({
      ...item,
      insertPosition: idx + 1,
    }));
    presets.value[index].items = itemsWithUpdatedPosition;
    presets.value[index].updatedAt = Date.now();
    await savePresets();
  }
};

// 保存预设列表
const savePresets = async () => {
  await setStorage(STORAGE_KEYS.PROMPT_PRESETS, presets.value);
};

// 保存当前选中的预设ID
const saveSelectedPreset = async () => {
  await setStorage(STORAGE_KEYS.SELECTED_PROMPT_PRESET, selectedPresetId.value);
};

// 加载预设列表
const loadPresets = async () => {
  const stored = await getStorage<PromptPreset[]>(
    STORAGE_KEYS.PROMPT_PRESETS,
    [...DEFAULT_PROMPT_PRESETS].map(p => ({ ...p, items: [...p.items] }))
  );
  presets.value = stored;

  const selectedId = await getStorage<string>(STORAGE_KEYS.SELECTED_PROMPT_PRESET, '');
  if (selectedId) {
    const exists = presets.value.some(p => p.id === selectedId);
    if (exists) {
      selectedPresetId.value = selectedId;
    }
  }

  loadCurrentPresetItems();
};

// 加载当前预设的条目
const loadCurrentPresetItems = () => {
  const currentPreset = presets.value.find(p => p.id === selectedPresetId.value);
  if (currentPreset) {
    promptItems.value = currentPreset.items
      .map((item, idx) => ({
        ...item,
        enabled: item.enabled !== undefined ? item.enabled : true,
        prompt: item.prompt !== undefined ? item.prompt : '',
        roleType: item.roleType !== undefined ? item.roleType : 'system',
        insertPosition: item.insertPosition !== undefined ? item.insertPosition : idx + 1,
      }))
      .sort((a, b) => (a.insertPosition ?? 999) - (b.insertPosition ?? 999));
  } else {
    promptItems.value = [...DEFAULT_PROMPT_ITEMS].map(item => ({ ...item }));
  }
};

// 切换预设
const selectPreset = async (id: string) => {
  selectedPresetId.value = id;
  await saveSelectedPreset();
  loadCurrentPresetItems();
};

// 打开预设菜单
const openPresetMenu = () => {
  showPresetMenu.value = true;
};

// 关闭预设菜单
const closePresetMenu = () => {
  showPresetMenu.value = false;
};

// 添加新预设
const handleAddPreset = async (name: string) => {
  showPresetMenu.value = false;
  const newPreset: PromptPreset = {
    id: 'preset-' + Date.now(),
    name: name,
    items: [...DEFAULT_PROMPT_ITEMS].map(item => ({ ...item })),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  presets.value.push(newPreset);
  await savePresets();
  await selectPreset(newPreset.id);
  const msg = getNotificationMessage('PROMPT_PRESET_CREATE_SUCCESS', { name });
  showSuccess(msg.title, msg.message);
};

// 重命名预设
const renamePreset = async (presetId: string, name: string) => {
  if (!name.trim()) return;

  const index = presets.value.findIndex(p => p.id === presetId);
  if (index !== -1 && presets.value[index]) {
    presets.value[index].name = name.trim();
    presets.value[index].updatedAt = Date.now();
    await savePresets();
    const msg = getNotificationMessage('PROMPT_PRESET_RENAME_SUCCESS', { name });
    showSuccess(msg.title, msg.message);
  }
};

// 打开删除确认
const openDeleteConfirm = (presetId: string) => {
  if (presets.value.length <= 1) return;

  const preset = presets.value.find(p => p.id === presetId);
  if (preset) {
    deleteTargetType.value = 'preset';
    showDeleteConfirm(presetId, preset.name, '预设');
  }
};

// 确认删除
const handleConfirmDelete = async () => {
  const id = confirmDelete();
  if (!id) return;

  if (deleteTargetType.value === 'preset') {
    if (presets.value.length <= 1) return;

    presets.value = presets.value.filter(p => p.id !== id);
    await savePresets();
    const msg = getNotificationMessage('PROMPT_PRESET_DELETE_SUCCESS');
    showInfo(msg.title, msg.message);

    if (id === selectedPresetId.value && presets.value.length > 0 && presets.value[0]) {
      await selectPreset(presets.value[0].id);
    }
  } else {
    promptItems.value = promptItems.value.filter(i => i.id !== id);
    await saveCurrentPresetItems();
    const msg = getNotificationMessage('PROMPT_ITEM_DELETE_SUCCESS');
    showInfo(msg.title, msg.message);
  }

  deleteTargetType.value = 'preset';
};

// 条目操作相关函数
const addNewItem = async (item: Partial<PromptItem>) => {
  if (!item.name || !item.description) return;

  const newItemData: PromptItem = {
    id: 'custom-' + Date.now(),
    name: item.name,
    description: item.description,
    prompt: item.prompt || '',
    roleType: item.roleType || 'system',
    enabled: true,
    insertPosition: promptItems.value.length + 1,
  };

  promptItems.value.push(newItemData);
  await saveCurrentPresetItems();
  const msg = getNotificationMessage('PROMPT_ITEM_ADD_SUCCESS', { name: item.name });
  showSuccess(msg.title, msg.message);
  showNewItemForm.value = false;
  newItem.value = { name: '', description: '', prompt: '', roleType: 'system' };
};

const startEdit = (item: PromptItem) => {
  editingId.value = item.id;
  editingItem.value = { ...item };
};

const saveEdit = async () => {
  if (!editingId.value || !editingItem.value?.name || !editingItem.value?.description) return;

  const index = promptItems.value.findIndex(i => i.id === editingId.value);
  if (index !== -1 && promptItems.value[index]) {
    promptItems.value[index] = {
      id: promptItems.value[index].id,
      name: editingItem.value.name,
      description: editingItem.value.description,
      prompt: editingItem.value.prompt || '',
      roleType: editingItem.value.roleType || 'system',
      enabled: promptItems.value[index].enabled,
      insertPosition: promptItems.value[index].insertPosition,
    };
    await saveCurrentPresetItems();
    const msg = getNotificationMessage('PROMPT_ITEM_UPDATE_SUCCESS', { name: editingItem.value.name });
    showSuccess(msg.title, msg.message);
  }
  editingId.value = null;
  editingItem.value = {};
};

const cancelEdit = () => {
  editingId.value = null;
  editingItem.value = {};
};

const toggleItemEnabled = async (id: string) => {
  const index = promptItems.value.findIndex(i => i.id === id);
  if (index !== -1 && promptItems.value[index]) {
    promptItems.value[index].enabled = !promptItems.value[index].enabled;
    await saveCurrentPresetItems();
    const item = promptItems.value[index];
    if (item.enabled) {
      const msg = getNotificationMessage('PROMPT_ITEM_ENABLE_SUCCESS', { name: item.name });
      showSuccess(msg.title, msg.message);
    } else {
      const msg = getNotificationMessage('PROMPT_ITEM_DISABLE_SUCCESS', { name: item.name });
      showInfo(msg.title, msg.message);
    }
  }
};

const deleteItem = (id: string) => {
  const item = promptItems.value.find(i => i.id === id);
  if (item) {
    deleteTargetType.value = 'item';
    showDeleteConfirm(id, item.name, '条目');
  }
};

const handleReorder = async (newOrder: PromptItem[]) => {
  promptItems.value = newOrder;
  await saveCurrentPresetItems();
};

const handleDragStart = () => {
  isDragging.value = true;
};

const handleDragEnd = () => {
  isDragging.value = false;
};

const handleBack = () => {
  if (showNewItemForm.value) {
    showNewItemForm.value = false;
    newItem.value = { name: '', description: '', prompt: '', roleType: 'system' };
  } else if (editingId.value) {
    cancelEdit();
  } else {
    emit('back');
  }
};

onMounted(async () => {
  await loadPresets();
});
</script>

<template>
  <div class="prompt-preset-page">
    <!-- 页面头部 -->
    <PresetHeader
      :current-preset-name="currentPresetName"
      :enabled-count="enabledCount"
      :total-count="promptItems.length"
      :show-new-form="showNewItemForm"
      :theme="theme"
      @back="handleBack"
      @open-menu="openPresetMenu"
      @toggle-new-form="showNewItemForm ? (showNewItemForm = false, newItem = { name: '', description: '', prompt: '', roleType: 'system' }) : showNewItemForm = true"
    />

    <!-- 页面内容 -->
    <div :class="['page-content', { 'dragging-active': isDragging }]">
      <!-- 条目列表 -->
      <PromptItemList
        :items="promptItems"
        :theme="theme"
        :is-dragging="isDragging"
        :editing-id="editingId"
        :editing-item="editingItem"
        @toggle="toggleItemEnabled"
        @edit="startEdit"
        @save-edit="saveEdit"
        @cancel-edit="cancelEdit"
        @delete="deleteItem"
        @reorder="handleReorder"
        @drag-start="handleDragStart"
        @drag-end="handleDragEnd"
        @touch-start="() => {}"
        @touch-move="() => {}"
        @touch-end="() => {}"
      />
    </div>

    <!-- 预设菜单 -->
    <PromptMenu
      :show="showPresetMenu"
      :presets="presets"
      :selected-preset-id="selectedPresetId"
      @update:show="closePresetMenu"
      @select="selectPreset"
      @rename="renamePreset"
      @delete="openDeleteConfirm"
      @add-new="handleAddPreset"
    />

    <!-- 新建条目模态框 -->
    <PromptFormModal
      :show="showNewItemForm"
      mode="create"
      :item="newItem"
      @update:show="showNewItemForm = $event"
      @save="addNewItem"
    />

    <!-- 删除确认对话框 -->
    <ConfirmDialog
      v-bind="confirmDialogProps"
      @confirm="handleConfirmDelete"
      @cancel="cancelDelete"
    />
  </div>
</template>

<style scoped>
/* PromptPresetPage 主容器样式 */
.prompt-preset-page {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
  overflow: hidden;
}

/* 页面内容 */
.page-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  -webkit-overflow-scrolling: touch;
}

.page-content.dragging-active {
  overflow: hidden;
}
</style>