<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import type { KnowledgeBase, KnowledgeEntry } from '@/types';
import { useKnowledgeBases } from '../composables/useKnowledgeBases';
import { useConfirmDialog } from '../composables/useConfirmDialog';
import { useNotifications, getNotificationMessage } from '../modules/notification';
import KnowledgeBaseListView from './knowledge/KnowledgeBaseListView.vue';
import KnowledgeBaseDetailView from './knowledge/KnowledgeBaseDetailView.vue';
import KnowledgeBaseFormModal from './knowledge/KnowledgeBaseFormModal.vue';
import ConfirmDialog from '@/components/common/ConfirmDialog.vue';

const router = useRouter();

const {
  knowledgeBases,
  selectedKnowledgeBaseId,
  currentKnowledgeBase,
  selectKnowledgeBase,
  createKnowledgeBase,
  updateKnowledgeBase,
  deleteKnowledgeBase,
  addKnowledgeEntry,
  updateKnowledgeEntry,
  deleteKnowledgeEntry,
  toggleKnowledgeEntryEnabled,
  toggleGlobalEnabled,
  init,
} = useKnowledgeBases();

const { confirmDialogProps, showDeleteConfirm, confirmDelete, cancelDelete } = useConfirmDialog();
const { showSuccess, showInfo, showError } = useNotifications();

// 视图状态
const isViewingList = ref(true);

// 知识库管理相关
const showKbFormModal = ref(false);
const kbFormMode = ref<'create' | 'edit'>('create');
const editingKbData = ref<Partial<KnowledgeBase>>({});

// 切换到知识库列表视图
const goToListView = () => {
  isViewingList.value = true;
  selectKnowledgeBase(null);
};

// 选择知识库
const handleSelectKb = (id: string) => {
  selectKnowledgeBase(id);
  isViewingList.value = false;
};

// 切换知识库全局启用状态
const handleToggleGlobalEnabled = async (id: string) => {
  const kb = knowledgeBases.value.find(item => item.id === id);
  if (!kb) return;

  // 先记下切换前的状态：toggleGlobalEnabled 会同步翻转 globallyEnabled，
  // 翻转后再读会让提示文案正好反过来
  const wasEnabled = kb.globallyEnabled;
  const saved = await toggleGlobalEnabled(id);

  if (!saved) {
    const failed = getNotificationMessage('KNOWLEDGE_BASE_SAVE_FAILED', { name: kb.name });
    showError(failed.title, failed.message);
    return;
  }

  if (wasEnabled) {
    const msg = getNotificationMessage('KNOWLEDGE_BASE_DISABLE_SUCCESS', { name: kb.name });
    showInfo(msg.title, msg.message);
  } else {
    const msg = getNotificationMessage('KNOWLEDGE_BASE_ENABLE_SUCCESS', { name: kb.name });
    showSuccess(msg.title, msg.message);
  }
};

// 添加新知识库
const handleAddKb = () => {
  kbFormMode.value = 'create';
  showKbFormModal.value = true;
};

// 保存知识库
const handleSaveKb = async (data: { name: string; description: string }) => {
  const saved = kbFormMode.value === 'create'
    ? (await createKnowledgeBase(data.name, data.description)) !== null
    : selectedKnowledgeBaseId.value
      ? await updateKnowledgeBase(selectedKnowledgeBaseId.value, data)
      : false;

  if (!saved) {
    const failed = getNotificationMessage('KNOWLEDGE_BASE_SAVE_FAILED', { name: data.name });
    showError(failed.title, failed.message);
    return;
  }

  const msg = kbFormMode.value === 'create'
    ? getNotificationMessage('KNOWLEDGE_BASE_CREATE_SUCCESS', { name: data.name })
    : getNotificationMessage('KNOWLEDGE_BASE_UPDATE_SUCCESS', { name: data.name });
  showSuccess(msg.title, msg.message);
  showKbFormModal.value = false;
};

// 详情视图：更新知识库
const handleUpdateBase = async (data: { name: string; description: string }) => {
  if (!selectedKnowledgeBaseId.value) return;

  const saved = await updateKnowledgeBase(selectedKnowledgeBaseId.value, data);
  if (!saved) {
    const failed = getNotificationMessage('KNOWLEDGE_BASE_SAVE_FAILED', { name: data.name });
    showError(failed.title, failed.message);
    return;
  }

  const msg = getNotificationMessage('KNOWLEDGE_BASE_UPDATE_SUCCESS', { name: data.name });
  showSuccess(msg.title, msg.message);
};

// 详情视图：删除知识库
const handleDeleteBase = () => {
  if (currentKnowledgeBase.value) {
    showDeleteConfirm(currentKnowledgeBase.value.id, currentKnowledgeBase.value.name, '知识库');
  }
};

// 详情视图：切换条目启用状态
const handleToggleEntry = async (entryId: string) => {
  if (!selectedKnowledgeBaseId.value) return;

  const saved = await toggleKnowledgeEntryEnabled(selectedKnowledgeBaseId.value, entryId);
  if (!saved) {
    const failed = getNotificationMessage('KNOWLEDGE_BASE_ENTRY_SAVE_FAILED');
    showError(failed.title, failed.message);
  }
};

// 详情视图：更新条目
const handleUpdateEntry = async (
  entryId: string,
  data: { name: string; content: string; priority: number },
) => {
  if (!selectedKnowledgeBaseId.value) return;

  const saved = await updateKnowledgeEntry(selectedKnowledgeBaseId.value, entryId, data);
  if (!saved) {
    const failed = getNotificationMessage('KNOWLEDGE_BASE_ENTRY_SAVE_FAILED', { name: data.name });
    showError(failed.title, failed.message);
  }
};

// 详情视图：删除条目
const handleDeleteEntry = async (entryId: string) => {
  if (!selectedKnowledgeBaseId.value) return;

  const saved = await deleteKnowledgeEntry(selectedKnowledgeBaseId.value, entryId);
  if (!saved) {
    const failed = getNotificationMessage('KNOWLEDGE_BASE_ENTRY_SAVE_FAILED');
    showError(failed.title, failed.message);
    return;
  }

  const msg = getNotificationMessage('KNOWLEDGE_BASE_ENTRY_DELETE_SUCCESS');
  showInfo(msg.title, msg.message);
};

// 详情视图：重新排序条目
const handleReorderEntries = async (entries: KnowledgeEntry[]) => {
  if (!selectedKnowledgeBaseId.value) return;

  const saved = await updateKnowledgeBase(selectedKnowledgeBaseId.value, { entries });
  if (!saved) {
    const failed = getNotificationMessage('KNOWLEDGE_BASE_SAVE_FAILED');
    showError(failed.title, failed.message);
  }
};

// 详情视图：添加条目（来自表单模态框）
const handleSaveEntry = async (data: { name: string; content: string; priority: number }) => {
  if (!selectedKnowledgeBaseId.value) {
    return;
  }

  const entry = await addKnowledgeEntry(selectedKnowledgeBaseId.value, data.name, data.content, data.priority);
  if (!entry) {
    const failed = getNotificationMessage('KNOWLEDGE_BASE_ENTRY_SAVE_FAILED', { name: data.name });
    showError(failed.title, failed.message);
    return;
  }

  const msg = getNotificationMessage('KNOWLEDGE_BASE_ENTRY_ADD_SUCCESS', { name: data.name });
  showSuccess(msg.title, msg.message);
};

// 确认删除
const handleConfirmDelete = async () => {
  const id = confirmDelete();
  if (!id) return;

  const name = knowledgeBases.value.find(kb => kb.id === id)?.name ?? '知识库';
  const removed = await deleteKnowledgeBase(id);

  if (!removed) {
    const failed = getNotificationMessage('KNOWLEDGE_BASE_DELETE_FAILED', { name });
    showError(failed.title, failed.message);
    return;
  }

  const msg = getNotificationMessage('KNOWLEDGE_BASE_DELETE_SUCCESS');
  showInfo(msg.title, msg.message);
  goToListView();
};

const handleBack = () => {
  if (isViewingList.value) {
    router.back();
  } else {
    goToListView();
  }
};

onMounted(() => {
  init();
});
</script>

<template>
  <div class="knowledge-base-page">
    <!-- 列表视图 -->
    <KnowledgeBaseListView
      v-if="isViewingList"
      :knowledge-bases="knowledgeBases"
      :selected-knowledge-base-id="selectedKnowledgeBaseId"
      @back="handleBack"
      @select="handleSelectKb"
      @add="handleAddKb"
      @toggle-global-enabled="handleToggleGlobalEnabled"
    />

    <!-- 知识库详情视图 -->
    <KnowledgeBaseDetailView
      v-else
      :current-knowledge-base="currentKnowledgeBase"
      :selected-knowledge-base-id="selectedKnowledgeBaseId"
      @back="handleBack"
      @update-base="handleUpdateBase"
      @delete-base="handleDeleteBase"
      @toggle-entry="handleToggleEntry"
      @add-entry="handleSaveEntry"
      @update-entry="handleUpdateEntry"
      @delete-entry="handleDeleteEntry"
      @reorder-entries="handleReorderEntries"
    />

    <!-- 知识库表单模态框 -->
    <KnowledgeBaseFormModal
      :show="showKbFormModal"
      :mode="kbFormMode"
      :knowledge-base="editingKbData"
      @update:show="showKbFormModal = $event"
      @save="handleSaveKb"
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
.knowledge-base-page {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
  overflow: hidden;
}
</style>