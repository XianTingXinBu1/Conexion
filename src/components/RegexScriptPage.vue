<script setup lang="ts">
import { ref, computed } from 'vue';
import type { Theme, RegexRule } from '../types';
import { Plus, Hash } from 'lucide-vue-next';
import { useConfirmDialog } from '../composables/useConfirmDialog';
import { useNotifications, getNotificationMessage } from '../modules/notification';
import { useRegexRules } from '../composables/useRegexRules';
import { PageHeader, EmptyState, Modal } from './common';
import { RegexRuleCard, RegexRuleForm } from './regex';
import { FormActions } from './form';

interface Props {
  theme: Theme;
}

defineProps<Props>();

const emit = defineEmits<{
  back: [];
}>();

// 使用 composables
const { confirmDialogProps, showDeleteConfirm, confirmDelete, cancelDelete, ConfirmDialog } = useConfirmDialog();
const { showSuccess, showInfo } = useNotifications();
const { rules, addRule, updateRule, deleteRule, toggleEnabled } = useRegexRules();

// 模态框状态
const showNewModal = ref(false);
const showEditModal = ref(false);
const editingRuleId = ref<string | null>(null);

// 默认表单数据
const createDefaultForm = (): Partial<RegexRule> => ({
  name: '',
  enabled: true,
  pattern: '',
  flags: 'g',
  replacement: '',
  scope: 'all',
  applyTo: 'after-macro',
});

// 表单数据
const newRuleForm = ref<Partial<RegexRule>>(createDefaultForm());
const editRuleForm = ref<Partial<RegexRule>>({});

// 打开新建模态框
const openNewModal = () => {
  newRuleForm.value = createDefaultForm();
  showNewModal.value = true;
};

// 添加新规则
const handleAddRule = () => {
  if (!newRuleForm.value.name?.trim() || !newRuleForm.value.pattern?.trim()) return;

  addRule({
    name: newRuleForm.value.name.trim(),
    enabled: newRuleForm.value.enabled ?? true,
    pattern: newRuleForm.value.pattern.trim(),
    flags: newRuleForm.value.flags ?? 'g',
    replacement: newRuleForm.value.replacement ?? '',
    scope: newRuleForm.value.scope ?? 'all',
    applyTo: newRuleForm.value.applyTo ?? 'after-macro',
  });

  const msg = getNotificationMessage('REGEX_RULE_ADD_SUCCESS', { name: newRuleForm.value.name });
  showSuccess(msg.title, msg.message);
  showNewModal.value = false;
};

// 打开编辑模态框
const openEditModal = (rule: RegexRule) => {
  editingRuleId.value = rule.id;
  editRuleForm.value = { ...rule };
  showEditModal.value = true;
};

// 保存编辑
const handleSaveEdit = () => {
  if (!editingRuleId.value || !editRuleForm.value.name?.trim() || !editRuleForm.value.pattern?.trim()) return;

  const success = updateRule(editingRuleId.value, {
    name: editRuleForm.value.name.trim(),
    pattern: editRuleForm.value.pattern.trim(),
    enabled: editRuleForm.value.enabled,
    flags: editRuleForm.value.flags,
    replacement: editRuleForm.value.replacement,
    scope: editRuleForm.value.scope,
    applyTo: editRuleForm.value.applyTo,
  });

  if (success) {
    const msg = getNotificationMessage('REGEX_RULE_UPDATE_SUCCESS', { name: editRuleForm.value.name });
    showSuccess(msg.title, msg.message);
  }
  showEditModal.value = false;
  editingRuleId.value = null;
};

// 删除规则
const handleDeleteRule = (id: string) => {
  const rule = rules.value.find(r => r.id === id);
  if (rule) {
    showDeleteConfirm(id, rule.name, '规则');
  }
};

// 确认删除
const handleConfirmDelete = () => {
  const id = confirmDelete();
  if (!id) return;

  const success = deleteRule(id);
  if (success) {
    const msg = getNotificationMessage('REGEX_RULE_DELETE_SUCCESS');
    showInfo(msg.title, msg.message);
  }
};

// 切换启用状态
const handleToggleEnabled = (id: string) => {
  const rule = rules.value.find(r => r.id === id);
  if (!rule) return;

  const newEnabled = !rule.enabled;
  toggleEnabled(id);

  if (newEnabled) {
    const msg = getNotificationMessage('REGEX_RULE_ENABLE_SUCCESS', { name: rule.name });
    showSuccess(msg.title, msg.message);
  } else {
    const msg = getNotificationMessage('REGEX_RULE_DISABLE_SUCCESS', { name: rule.name });
    showInfo(msg.title, msg.message);
  }
};

// 计算表单操作按钮
const newFormActions = computed(() => [
  { type: 'secondary' as const, label: '取消' },
  { type: 'primary' as const, label: '添加', disabled: !newRuleForm.value.name?.trim() || !newRuleForm.value.pattern?.trim() },
]);

const editFormActions = computed(() => [
  { type: 'secondary' as const, label: '取消' },
  { type: 'primary' as const, label: '保存', disabled: !editRuleForm.value.name?.trim() || !editRuleForm.value.pattern?.trim() },
]);

const formActionsAlign = 'space-between' as const;
</script>

<template>
  <div class="regex-script-page">
    <!-- 顶部导航栏 -->
    <PageHeader
      title="正则脚本"
      subtitle="Regex Scripts"
      :show-back="true"
      :show-action="true"
      :action-icon="Plus"
      @back="emit('back')"
      @action="openNewModal"
    />

    <!-- 内容滚动区域 -->
    <div class="content-scroll">
      <!-- 规则列表 -->
      <div class="section">
        <div class="section-title">
          <span>规则列表 ({{ rules.length }})</span>
        </div>

        <EmptyState
          v-if="rules.length === 0"
          :icon="Hash"
          title="暂无规则"
          subtitle="点击右上角 + 添加新规则"
        />

        <div v-else class="rules-list">
          <RegexRuleCard
            v-for="rule in rules"
            :key="rule.id"
            :rule="rule"
            @toggle="handleToggleEnabled"
            @edit="openEditModal"
            @delete="handleDeleteRule"
          />
        </div>
      </div>
    </div>

    <!-- 新建规则模态框 -->
    <Modal
      v-model:show="showNewModal"
      title="新建规则"
      @close="showNewModal = false"
    >
      <RegexRuleForm
        v-model="newRuleForm"
        mode="create"
      />
      <template #footer>
        <FormActions
          :buttons="newFormActions"
          :equal-width="true"
          :align="formActionsAlign"
          @click="(btn) => btn.label === '添加' ? handleAddRule() : (showNewModal = false)"
        />
      </template>
    </Modal>

    <!-- 编辑规则模态框 -->
    <Modal
      v-model:show="showEditModal"
      title="编辑规则"
      @close="showEditModal = false"
    >
      <RegexRuleForm
        v-model="editRuleForm"
        mode="edit"
      />
      <template #footer>
        <FormActions
          :buttons="editFormActions"
          :equal-width="true"
          :align="formActionsAlign"
          @click="(btn) => btn.label === '保存' ? handleSaveEdit() : (showEditModal = false)"
        />
      </template>
    </Modal>

    <!-- 删除确认对话框 -->
    <ConfirmDialog
      v-bind="confirmDialogProps"
      @confirm="handleConfirmDelete"
      @cancel="cancelDelete"
    />
  </div>
</template>

<style scoped>
@import '../styles/regex-script.css';
</style>