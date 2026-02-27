<script setup lang="ts">
import { ref, computed } from 'vue';
import { ChevronLeft, Plus, X, Database, Trash2, MoreVertical, Edit2 } from 'lucide-vue-next';
import type { Theme, KnowledgeBase, KnowledgeEntry } from '../../types';
import { useConfirmDialog } from '../../composables/useConfirmDialog';
import { useDraggable } from '../../composables/useDraggable';
import { useNotifications, getNotificationMessage } from '../../modules/notification';
import KnowledgeEntryCard from './KnowledgeEntryCard.vue';
import KnowledgeBaseFormModal from './KnowledgeBaseFormModal.vue';
import KnowledgeEntryFormModal from './KnowledgeEntryFormModal.vue';
import EmptyState from '../common/EmptyState.vue';

interface Props {
  currentKnowledgeBase: KnowledgeBase | null;
  selectedKnowledgeBaseId: string | null;
  theme: Theme;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  back: [];
  updateBase: [data: { name: string; description: string }];
  deleteBase: [];
  toggleEntry: [entryId: string];
  updateEntry: [entryId: string, data: { name: string; content: string; priority: number }];
  deleteEntry: [entryId: string];
  reorderEntries: [entries: KnowledgeEntry[]];
}>();

const { confirmDialogProps, showDeleteConfirm, confirmDelete, cancelDelete } = useConfirmDialog();
const { showSuccess, showInfo } = useNotifications();

// 知识库菜单
const showKbMenu = ref(false);

// 知识库管理相关
const showKbFormModal = ref(false);
const kbFormMode = ref<'create' | 'edit'>('create');
const editingKbData = ref<Partial<KnowledgeBase>>({});

// 条目管理相关
const showEntryFormModal = ref(false);
const entryFormMode = ref<'create' | 'edit'>('create');
const editingEntryData = ref<Partial<KnowledgeEntry>>({});
const editingId = ref<string | null>(null);

// 当前知识库的条目列表
const currentEntries = computed(() => props.currentKnowledgeBase?.entries || []);

// 使用拖拽 composable
const {
  draggedIndex,
  isDragging,
  insertBeforeIndex,
  handleDragStart,
  handleDragOver,
  handleDrop,
  handleDragEnd,
  getItemStyle: getDragItemStyle,
} = useDraggable(currentEntries, {
  itemHeight: 74,
  onDragEnd: () => {
    // 拖拽结束后通知父组件更新条目顺序
    if (props.currentKnowledgeBase) {
      emit('reorderEntries', [...props.currentKnowledgeBase.entries]);
    }
  },
});

// 切换条目启用状态
const handleToggleEntry = (entryId: string) => {
  emit('toggleEntry', entryId);
};

// 更新条目
const handleUpdateEntry = (entryId: string, data: { name: string; content: string; priority: number }) => {
  emit('updateEntry', entryId, data);
};

// 删除条目
const handleDeleteEntry = (entryId: string) => {
  const entry = currentEntries.value.find(e => e.id === entryId);
  if (entry) {
    showDeleteConfirm(entryId, entry.name, '条目');
  }
};

// 开始编辑条目
const startEditEntry = (entry: KnowledgeEntry) => {
  editingId.value = entry.id;
  editingEntryData.value = { ...entry };
};

// 保存编辑的条目
const saveEditEntry = () => {
  if (editingId.value && editingEntryData.value) {
    handleUpdateEntry(editingId.value, {
      name: editingEntryData.value.name || '',
      content: editingEntryData.value.content || '',
      priority: editingEntryData.value.priority ?? 50,
    });
  }
  editingId.value = null;
  editingEntryData.value = {};
};

// 取消编辑条目
const cancelEditEntry = () => {
  editingId.value = null;
  editingEntryData.value = {};
};

// 打开知识库菜单
const openKbMenu = (event: MouseEvent) => {
  event.stopPropagation();
  showKbMenu.value = !showKbMenu.value;
};

// 关闭知识库菜单
const closeKbMenu = () => {
  showKbMenu.value = false;
};

// 重命名知识库
const handleRenameKb = () => {
  if (props.currentKnowledgeBase) {
    editingKbData.value = { ...props.currentKnowledgeBase };
    kbFormMode.value = 'edit';
    showKbFormModal.value = true;
  }
  closeKbMenu();
};

// 删除知识库
const handleDeleteKb = () => {
  emit('deleteBase');
  closeKbMenu();
};

// 保存知识库
const handleSaveKb = (data: { name: string; description: string }) => {
  emit('updateBase', data);
  const msg = getNotificationMessage('KNOWLEDGE_BASE_UPDATE_SUCCESS', { name: data.name });
  showSuccess(msg.title, msg.message);
  showKbFormModal.value = false;
};

// 保存条目
const handleSaveEntry = (data: { name: string; content: string; priority: number }) => {
  if (entryFormMode.value === 'create') {
    const msg = getNotificationMessage('KNOWLEDGE_BASE_ENTRY_ADD_SUCCESS', { name: data.name });
    showSuccess(msg.title, msg.message);
  } else {
    if (editingId.value) {
      handleUpdateEntry(editingId.value, data);
      const msg = getNotificationMessage('KNOWLEDGE_BASE_ENTRY_UPDATE_SUCCESS', { name: data.name });
      showSuccess(msg.title, msg.message);
    }
  }
  showEntryFormModal.value = false;
};

// 确认删除
const handleConfirmDelete = () => {
  const id = confirmDelete();
  if (!id) return;

  // 删除条目
  emit('deleteEntry', id);
  const msg = getNotificationMessage('KNOWLEDGE_BASE_ENTRY_DELETE_SUCCESS');
  showInfo(msg.title, msg.message);
};
</script>

<template>
  <div class="kb-detail-view" @click="closeKbMenu">
    <header class="page-header" @click.stop>
      <button class="nav-btn" @click="emit('back')">
        <ChevronLeft :size="22" />
      </button>
      <div class="header-content">
        <div class="page-title">
          {{ currentKnowledgeBase?.name || '未知' }}
        </div>
        <div class="page-subtitle">
          {{ currentEntries.filter(e => e.enabled).length }}/{{ currentEntries.length }} 个条目已启用
        </div>
      </div>
      <div class="header-actions">
        <button class="nav-btn" @click="showEntryFormModal ? (showEntryFormModal = false) : showEntryFormModal = true">
          <X v-if="showEntryFormModal" :size="22" />
          <Plus v-else :size="22" />
        </button>
        <div class="menu-container">
          <button class="nav-btn" @click="openKbMenu">
            <MoreVertical :size="22" />
          </button>
          <transition name="dropdown">
            <div v-if="showKbMenu" class="dropdown-menu" @click.stop>
              <button class="dropdown-item" @click="handleRenameKb">
                <Edit2 :size="16" />
                <span>重命名</span>
              </button>
              <button class="dropdown-item dropdown-item--danger" @click="handleDeleteKb">
                <Trash2 :size="16" />
                <span>删除</span>
              </button>
            </div>
          </transition>
        </div>
      </div>
    </header>

    <div :class="['page-content', { 'dragging-active': isDragging }]">
      <div v-if="currentEntries.length > 0" :class="['entry-list', { 'dragging-active': isDragging }]">
        <div
          v-for="(entry, index) in currentEntries"
          :key="entry.id"
          class="entry-item-wrapper"
          :style="getDragItemStyle(index)"
          @dragover="handleDragOver"
          @drop="handleDrop(index)"
        >
          <KnowledgeEntryCard
            :index="index"
            :entry="entry"
            :is-editing="editingId === entry.id"
            :is-dragging="draggedIndex === index"
            :insert-before="insertBeforeIndex === index"
            :editing-data="editingEntryData"
            @toggle="handleToggleEntry"
            @start-edit="startEditEntry"
            @save-edit="saveEditEntry"
            @cancel-edit="cancelEditEntry"
            @delete="handleDeleteEntry"
            @drag-start="handleDragStart"
            @drag-end="handleDragEnd"
          />
        </div>
      </div>
      <EmptyState
        v-else
        :icon="Database"
        title="暂无条目"
        subtitle="点击右上角 + 添加新条目"
      />
    </div>

    <!-- 知识库表单模态框 -->
    <KnowledgeBaseFormModal
      :show="showKbFormModal"
      :mode="kbFormMode"
      :knowledge-base="editingKbData"
      @update:show="showKbFormModal = $event"
      @save="handleSaveKb"
    />

    <!-- 条目表单模态框 -->
    <KnowledgeEntryFormModal
      :show="showEntryFormModal"
      :mode="entryFormMode"
      :entry="editingEntryData"
      @update:show="showEntryFormModal = $event"
      @save="handleSaveEntry"
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
.kb-detail-view {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
  overflow: hidden;
}

.page-header {
  padding: 20px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.header-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.page-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-main);
  letter-spacing: -0.3px;
}

.page-subtitle {
  font-size: 11px;
  color: var(--text-muted);
  font-weight: 500;
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

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.menu-container {
  position: relative;
}

.dropdown-menu {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  min-width: 140px;
  padding: 6px;
  z-index: 100;
}

.dropdown-enter-active,
.dropdown-leave-active {
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.95);
}

.dropdown-item {
  width: 100%;
  padding: 10px 12px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: var(--text-main);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 10px;
  transition: all 0.2s ease;
  text-align: left;
}

.dropdown-item:active {
  transform: scale(0.98);
  background: var(--accent-soft);
}

.dropdown-item--danger {
  color: #ef4444;
}

.dropdown-item--danger:active {
  background: rgba(239, 68, 68, 0.1);
}

.page-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  -webkit-overflow-scrolling: touch;
}

.page-content.dragging-active {
  overflow: hidden;
}

.entry-item-wrapper {
  position: relative;
}

.entry-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  user-select: none;
}

.entry-list.dragging-active {
  touch-action: none;
}
</style>