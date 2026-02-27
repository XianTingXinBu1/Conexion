<script setup lang="ts">
import { ref, computed } from 'vue';
import { Trash2, RotateCcw, Database } from 'lucide-vue-next';

interface Props {
  dataSize: number;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  deleteAllData: [];
  restoreDefaults: [];
}>();

// 确认对话框状态
const showDeleteDialog = ref(false);
const showRestoreDialog = ref(false);

const handleDeleteAllData = () => {
  showDeleteDialog.value = true;
};

const confirmDeleteAllData = () => {
  emit('deleteAllData');
  showDeleteDialog.value = false;
};

const handleRestoreDefaults = () => {
  showRestoreDialog.value = true;
};

const confirmRestoreDefaults = () => {
  emit('restoreDefaults');
  showRestoreDialog.value = false;
};

// 计算数据占用大小
const dataSizeFormatted = computed(() => {
  const bytes = props.dataSize;
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
});
</script>

<template>
  <div class="section">
    <div class="section-title">
      <span>数据管理</span>
    </div>

    <div class="info-item">
      <div class="info-content">
        <Database :size="20" class="info-icon" />
        <div class="info-text">
          <div class="info-label">数据占用</div>
          <div class="info-value">{{ dataSizeFormatted }}</div>
        </div>
      </div>
    </div>

    <div class="action-item">
      <div class="action-info">
        <Trash2 :size="20" class="action-icon delete-icon" />
        <div class="action-text">
          <div class="action-name">删除所有数据</div>
          <div class="action-desc">清除所有本地存储数据</div>
        </div>
      </div>
      <button class="action-btn delete-btn" @click="handleDeleteAllData">
        删除
      </button>
    </div>

    <div class="action-item">
      <div class="action-info">
        <RotateCcw :size="20" class="action-icon restore-icon" />
        <div class="action-text">
          <div class="action-name">恢复默认设置</div>
          <div class="action-desc">重置所有设置项为默认值</div>
        </div>
      </div>
      <button class="action-btn restore-btn" @click="handleRestoreDefaults">
        恢复
      </button>
    </div>

    <!-- 删除所有数据确认对话框 -->
    <ConfirmDialog
      :show="showDeleteDialog"
      type="delete"
      title="删除所有数据"
      message="确定要删除所有数据吗？此操作将清除所有本地存储的数据，包括设置、角色、会话、预设等。"
      description="此操作不可恢复，请谨慎操作。"
      confirm-text="删除全部"
      cancel-text="取消"
      @confirm="confirmDeleteAllData"
      @cancel="showDeleteDialog = false"
    />

    <!-- 恢复默认设置确认对话框 -->
    <ConfirmDialog
      :show="showRestoreDialog"
      type="warning"
      title="恢复默认设置"
      message="确定要恢复默认设置吗？此操作将重置所有设置项为默认值。"
      description="您已保存的角色、会话、预设等数据将保留。"
      confirm-text="恢复默认"
      cancel-text="取消"
      @confirm="confirmRestoreDefaults"
      @cancel="showRestoreDialog = false"
    />
  </div>
</template>

<style scoped>
/* 分组 */
.section {
  margin-bottom: 20px;
}

.section:last-child {
  margin-bottom: 0;
}

.section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-muted);
  margin-bottom: 14px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* 信息展示项 */
.info-item {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px 0;
  background: var(--bg-secondary);
  border-radius: 12px;
  margin-bottom: 12px;
}

.info-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

.info-icon {
  color: var(--accent-purple);
}

.info-text {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.info-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-muted);
}

.info-value {
  font-size: 18px;
  font-weight: 700;
  color: var(--accent-purple);
  font-feature-settings: 'tnum';
  letter-spacing: -0.5px;
}

/* 操作项 */
.action-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 0;
}

.action-info {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
}

.action-icon {
  flex-shrink: 0;
}

.delete-icon {
  color: #ef4444;
}

.restore-icon {
  color: #f59e0b;
}

.action-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.action-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-main);
}

.action-desc {
  font-size: 12px;
  color: var(--text-muted);
}

.action-btn {
  padding: 8px 16px;
  border-radius: 8px;
  border: none;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.action-btn:active {
  transform: scale(0.95);
}

.delete-btn {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.delete-btn:active {
  background: rgba(239, 68, 68, 0.2);
}

.restore-btn {
  background: rgba(245, 158, 11, 0.1);
  color: #f59e0b;
}

.restore-btn:active {
  background: rgba(245, 158, 11, 0.2);
}
</style>