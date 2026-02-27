<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { Plus, Hash } from 'lucide-vue-next';
import type { Theme, RegexRule } from '../types';
import { DEFAULT_REGEX_SCRIPTS } from '../constants';
import { useConfirmDialog } from '../composables/useConfirmDialog';
import { useNotifications, getNotificationMessage } from '../modules/notification';
import { getStorage, setStorage } from '@/utils/storage';
import { PageHeader, EmptyState, Modal } from './common';
import { RegexRuleCard, RegexRuleForm } from './regex';
import { FormActions } from './form';

interface Props {
  theme: Theme;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  back: [];
  toggleTheme: [];
}>();

// 使用确认对话框 composable
const { confirmDialogProps, showDeleteConfirm, confirmDelete, cancelDelete, ConfirmDialog } = useConfirmDialog();

// 使用通知 composable
const { showSuccess, showInfo } = useNotifications();

// 规则管理
const rules = ref<RegexRule[]>([]);

// 模态框状态
const showNewModal = ref(false);
const showEditModal = ref(false);
const editingRuleId = ref<string | null>(null);

// 表单数据
const newRuleForm = ref<Partial<RegexRule>>({
  name: '',
  enabled: true,
  pattern: '',
  flags: 'g',
  replacement: '',
  scope: 'all',
  applyTo: 'after-macro',
});

const editRuleForm = ref<Partial<RegexRule>>({});

// 加载规则
const loadRules = async () => {
  const stored = await getStorage<RegexRule[]>('conexion_regex_scripts', [...DEFAULT_REGEX_SCRIPTS]);
  rules.value = stored;
};

// 保存规则
const saveRules = async () => {
  await setStorage('conexion_regex_scripts', rules.value);
};

// 打开新建模态框
const openNewModal = () => {
  newRuleForm.value = {
    name: '',
    enabled: true,
    pattern: '',
    flags: 'g',
    replacement: '',
    scope: 'all',
    applyTo: 'after-macro',
  };
  showNewModal.value = true;
};

// 添加新规则
const handleAddRule = async () => {
  if (!newRuleForm.value.name?.trim() || !newRuleForm.value.pattern?.trim()) return;

  const rule: RegexRule = {
    id: Date.now().toString(),
    name: newRuleForm.value.name!,
    enabled: newRuleForm.value.enabled ?? true,
    pattern: newRuleForm.value.pattern!,
    flags: newRuleForm.value.flags ?? 'g',
    replacement: newRuleForm.value.replacement ?? '',
    scope: newRuleForm.value.scope ?? 'all',
    applyTo: newRuleForm.value.applyTo ?? 'after-macro',
  };

  rules.value.push(rule);
  await saveRules();
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
const handleSaveEdit = async () => {
  if (!editingRuleId.value || !editRuleForm.value.name?.trim() || !editRuleForm.value.pattern?.trim()) return;

  const index = rules.value.findIndex(r => r.id === editingRuleId.value);
  if (index !== -1) {
    rules.value[index] = {
      ...rules.value[index],
      ...editRuleForm.value,
    } as RegexRule;
    await saveRules();
    const msg = getNotificationMessage('REGEX_RULE_UPDATE_SUCCESS', { name: editRuleForm.value.name });
    showSuccess(msg.title, msg.message);
  }
  showEditModal.value = false;
  editingRuleId.value = null;
};

// 删除规则
const deleteRule = (id: string) => {
  const rule = rules.value.find(r => r.id === id);
  showDeleteConfirm(id, rule?.name || '', '规则');
};

// 确认删除
const handleConfirmDelete = async () => {
  const id = confirmDelete();
  if (!id) return;

  rules.value = rules.value.filter(r => r.id !== id);
  await saveRules();
  const msg = getNotificationMessage('REGEX_RULE_DELETE_SUCCESS');
  showInfo(msg.title, msg.message);
};

// 切换启用状态
const toggleEnabled = async (id: string) => {
  const rule = rules.value.find(r => r.id === id);
  if (rule) {
    rule.enabled = !rule.enabled;
    await saveRules();
    if (rule.enabled) {
      const msg = getNotificationMessage('REGEX_RULE_ENABLE_SUCCESS', { name: rule.name });
      showSuccess(msg.title, msg.message);
    } else {
      const msg = getNotificationMessage('REGEX_RULE_DISABLE_SUCCESS', { name: rule.name });
      showInfo(msg.title, msg.message);
    }
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

onMounted(async () => {
  await loadRules();
});
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
            @toggle="toggleEnabled"
            @edit="openEditModal"
            @delete="deleteRule"
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