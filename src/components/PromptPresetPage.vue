<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import type { PromptPreset, PromptItem } from '@/types';
import { DEFAULT_PROMPT_ITEMS } from '../constants';
import { useConfirmDialog } from '../composables/useConfirmDialog';
import { createId } from '@/utils/id';
import { useNotifications, getNotificationMessage } from '../modules/notification';
import {
  loadPromptPresets as loadPromptPresetsFromRepository,
  loadSelectedPromptPresetId,
  savePromptPresets as savePromptPresetsToRepository,
  saveSelectedPromptPresetId,
} from '@/repositories/promptPresetRepository';
import PresetHeader from './prompt/PresetHeader.vue';
import PromptMenu from './prompt/PromptMenu.vue';
import PromptItemList from './prompt/PromptItemList.vue';
import PromptFormModal from './prompt/PromptFormModal.vue';
import ConfirmDialog from '@/components/common/ConfirmDialog.vue';

const router = useRouter();

// 使用确认对话框 composable
const { confirmDialogProps, showDeleteConfirm, confirmDelete, cancelDelete } = useConfirmDialog();

// 使用通知 composable
const { showSuccess, showInfo, showError } = useNotifications();

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
const saveCurrentPresetItems = async (): Promise<boolean> => {
  const index = presets.value.findIndex(p => p.id === selectedPresetId.value);
  if (index === -1 || !presets.value[index]) {
    // 选中的预设已经不存在（例如被删/被替换）：不能静默成功
    reportSaveFailure(new Error('未找到当前预设'));
    return false;
  }

  const backupPresets = cloneList(presets.value);
  const itemsWithUpdatedPosition = promptItems.value.map((item, idx) => ({
    ...item,
    insertPosition: idx + 1,
  }));
  presets.value[index].items = itemsWithUpdatedPosition;
  presets.value[index].updatedAt = Date.now();

  try {
    await savePresets();
    return true;
  } catch (error) {
    reportSaveFailure(error, backupPresets);
    // 视图数据是独立 ref，也必须退回落库失败前的状态，
    // 否则界面仍显示一份后端并不存在的条目列表
    const restored = backupPresets.find(p => p.id === selectedPresetId.value);
    if (restored) {
      promptItems.value = normalizeItems(restored.items);
    }
    return false;
  }
};

// 保存预设列表
const savePresets = async () => {
  await savePromptPresetsToRepository(presets.value);
};

const cloneList = <T,>(list: T[]): T[] => JSON.parse(JSON.stringify(list)) as T[];

/**
 * 落库失败时的统一处理：回滚 presets（改内存 → PUT 的写路径都在这里收口），
 * 并把错误摆到用户面前。
 *
 * 以前所有 repository 调用都是裸 await：失败时界面已经改了、提示还没出现，
 * 控制台只有一个未捕获的 rejection。
 */
const reportSaveFailure = (error: unknown, backupPresets?: PromptPreset[]): void => {
  if (backupPresets) {
    presets.value = backupPresets;
  }
  const msg = getNotificationMessage('PROMPT_PRESET_SAVE_FAILED');
  showError(msg.title, error instanceof Error ? `${msg.message}（${error.message}）` : msg.message);
};

// 保存当前选中的预设ID
const saveSelectedPreset = async () => {
  await saveSelectedPromptPresetId(selectedPresetId.value);
};

// 加载预设列表
const loadPresets = async () => {
  presets.value = await loadPromptPresetsFromRepository();

  const selectedId = await loadSelectedPromptPresetId();
  if (selectedId) {
    const exists = presets.value.some(p => p.id === selectedId);
    if (exists) {
      selectedPresetId.value = selectedId;
    }
  }

  loadCurrentPresetItems();
};

/** 把落库数据规范成视图数据：补默认值，再按 insertPosition 排序 */
const normalizeItems = (items: PromptItem[]): PromptItem[] =>
  items
    .map((item, idx) => ({
      ...item,
      enabled: item.enabled !== undefined ? item.enabled : true,
      prompt: item.prompt !== undefined ? item.prompt : '',
      roleType: item.roleType !== undefined ? item.roleType : 'system',
      insertPosition: item.insertPosition !== undefined ? item.insertPosition : idx + 1,
    }))
    .sort((a, b) => (a.insertPosition ?? 999) - (b.insertPosition ?? 999));

// 加载当前预设的条目
const loadCurrentPresetItems = () => {
  const currentPreset = presets.value.find(p => p.id === selectedPresetId.value);
  if (currentPreset) {
    promptItems.value = normalizeItems(currentPreset.items);
  } else {
    promptItems.value = [...DEFAULT_PROMPT_ITEMS].map(item => ({ ...item }));
  }
};

// 切换预设
const selectPreset = async (id: string) => {
  selectedPresetId.value = id;
  // 先换列表再落库：标题读的是 selectedPresetId，若等设置写完再刷新条目，
  // 保存耗时期间会显示「新预设名 + 旧预设条目」这种不一致的中间态。
  loadCurrentPresetItems();
  await saveSelectedPreset();
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
    id: `preset-${createId()}`,
    name: name,
    items: [...DEFAULT_PROMPT_ITEMS].map(item => ({ ...item })),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  const backupPresets = cloneList(presets.value);

  presets.value.push(newPreset);
  try {
    await savePresets();
  } catch (error) {
    reportSaveFailure(error, backupPresets);
    return;
  }

  await selectPreset(newPreset.id);
  const msg = getNotificationMessage('PROMPT_PRESET_CREATE_SUCCESS', { name });
  showSuccess(msg.title, msg.message);
};

// 重命名预设
const renamePreset = async (presetId: string, name: string) => {
  if (!name.trim()) return;

  const index = presets.value.findIndex(p => p.id === presetId);
  if (index === -1 || !presets.value[index]) {
    reportSaveFailure(new Error('预设不存在'));
    return;
  }

  const backupPresets = cloneList(presets.value);
  presets.value[index].name = name.trim();
  presets.value[index].updatedAt = Date.now();

  try {
    await savePresets();
  } catch (error) {
    reportSaveFailure(error, backupPresets);
    return;
  }

  const msg = getNotificationMessage('PROMPT_PRESET_RENAME_SUCCESS', { name });
  showSuccess(msg.title, msg.message);
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

    const backupPresets = cloneList(presets.value);
    const backupSelected = selectedPresetId.value;

    presets.value = presets.value.filter(p => p.id !== id);
    try {
      await savePresets();
    } catch (error) {
      selectedPresetId.value = backupSelected;
      reportSaveFailure(error, backupPresets);
      return;
    }

    const msg = getNotificationMessage('PROMPT_PRESET_DELETE_SUCCESS');
    showInfo(msg.title, msg.message);

    if (id === selectedPresetId.value && presets.value.length > 0 && presets.value[0]) {
      await selectPreset(presets.value[0].id);
    }
  } else {
    promptItems.value = promptItems.value.filter(i => i.id !== id);
    // saveCurrentPresetItems 内部已处理失败提示与回滚，这里只在成功时提示
    if (!(await saveCurrentPresetItems())) {
      return;
    }
    const msg = getNotificationMessage('PROMPT_ITEM_DELETE_SUCCESS');
    showInfo(msg.title, msg.message);
  }

  deleteTargetType.value = 'preset';
};

// 条目操作相关函数
const addNewItem = async (item: Partial<PromptItem>) => {
  if (!item.name?.trim()) return;

  const newItemData: PromptItem = {
    id: `custom-${createId()}`,
    name: item.name,
    description: item.description ?? '',
    prompt: item.prompt || '',
    roleType: item.roleType || 'system',
    enabled: true,
    insertPosition: promptItems.value.length + 1,
  };

  promptItems.value.push(newItemData);
  // 落库失败时 saveCurrentPresetItems 已回滚并提示，这里保留表单让用户重试
  if (!(await saveCurrentPresetItems())) return;
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
  if (!editingId.value || !editingItem.value?.name?.trim()) return;

  const index = promptItems.value.findIndex(i => i.id === editingId.value);
  if (index !== -1 && promptItems.value[index]) {
    promptItems.value[index] = {
      id: promptItems.value[index].id,
      name: editingItem.value.name,
      description: editingItem.value.description ?? '',
      prompt: editingItem.value.prompt || '',
      roleType: editingItem.value.roleType || 'system',
      enabled: promptItems.value[index].enabled,
      insertPosition: promptItems.value[index].insertPosition,
    };
    // 失败时保留编辑态，别把用户输入一起关掉
    if (!(await saveCurrentPresetItems())) return;
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
    if (!(await saveCurrentPresetItems())) return;
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
  // 失败时 saveCurrentPresetItems 会把列表退回原顺序
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
    router.back();
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
      @back="handleBack"
      @open-menu="openPresetMenu"
      @toggle-new-form="showNewItemForm ? (showNewItemForm = false, newItem = { name: '', description: '', prompt: '', roleType: 'system' }) : showNewItemForm = true"
    />

    <!-- 页面内容 -->
    <div :class="['page-content', { 'dragging-active': isDragging }]">
      <!-- 条目列表 -->
      <PromptItemList
        :items="promptItems"
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