<script setup lang="ts">
import { onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { Save, RefreshCw, Zap, AlertTriangle } from 'lucide-vue-next';
import { DEFAULTS } from '../constants';
import PageHeader from './common/PageHeader.vue';
import Modal from './common/Modal.vue';
import { ApiConfigForm, ModelSelector, ParameterSettings, PresetSelector, useApiPresets } from '../modules/api-preset';
import { useApiModels } from '../composables/useApiModels';
import { useApiConnection } from '../composables/useApiConnection';
import { useNotifications, getNotificationMessage } from '../modules/notification';
import { useFormDataManager, usePageLeaveGuard } from '../composables';

const router = useRouter();

// 使用 composables
const {
  presets,
  selectedPreset,
  currentPreset,
  showNewPresetDialog,
  showRenameDialog,
  newPresetName,
  renamePresetName,
  canCreatePreset,
  canRenamePreset,
  confirmDialogProps,
  ConfirmDialog,
  loadPresets,
  loadSelectedPreset,
  selectPreset,
  saveCurrentPreset,
  createNewPreset,
  deletePreset,
  handleConfirmDelete,
  openRenameDialog,
  renamePreset,
  openCreateNewDialog,
  loadPresetToForm,
  createDefaultPresetFormData,
  cancelDelete,
  onPresetChange,
} = useApiPresets();

const {
  models,
  selectedModel,
  modelInput,
  isLoadingModels,
  loadModels,
  saveModels,
  clearModels,
  shouldClearModels,
  updateModelInput,
  fetchModels,
} = useApiModels();

const { isTestingConnection, testConnection } = useApiConnection();

// 通知系统
const { showSuccess, showError } = useNotifications();

// 使用表单数据管理器（不包括modelInput，使用useApiModels的modelInput）
const {
  urlInput,
  apiKeyInput,
  streamEnabled,
  temperature,
  maxTokens,
  maxOutputTokens,
  proxyEnabled,
  proxyUrl,
  proxyType,
  proxyTargetEndpoint,
  hasUnsavedChanges,
  updateOriginalData,
  getFormData: getFormDataInternal,
  loadFormData,
} = useFormDataManager({
  initialData: {
    streamEnabled: DEFAULTS.STREAM_ENABLED,
    temperature: DEFAULTS.TEMPERATURE,
    maxTokens: DEFAULTS.MAX_TOKENS,
    maxOutputTokens: DEFAULTS.MAX_OUTPUT_TOKENS,
    proxy: {
      enabled: false,
      url: '',
      type: 'query',
      targetEndpoint: '',
    },
  },
});

// 获取当前表单数据（合并模型信息）
function getFormData() {
  return {
    ...getFormDataInternal(),
    model: modelInput.value || selectedModel.value,
  };
}

// 使用页面离开守卫
const {
  showLeaveConfirm,
  confirmDialogProps: leaveConfirmDialogProps,
  checkBeforeLeave,
  handleSaveAndLeave,
  handleDiscardAndLeave,
  handleCancelLeave,
} = usePageLeaveGuard({
  enabled: hasUnsavedChanges,
  title: '未保存的更改',
  message: '您有未保存的更改',
  description: '是否保存更改后再离开？不保存将丢失所有修改。',
  saveText: '保存并退出',
  discardText: '不保存',
  cancelText: '取消',
});

function applyPresetToForm(preset: NonNullable<typeof currentPreset.value>) {
  const formData = loadPresetToForm(preset);
  loadFormData(formData);

  selectedModel.value = formData.model;
  modelInput.value = formData.model;
  updateModelInput();
  updateOriginalData();
}

function initializePresetForm() {
  const preset = currentPreset.value;
  if (!preset) {
    loadFormData(createDefaultPresetFormData());
    updateModelInput();
    updateOriginalData();
    return;
  }

  if (shouldClearModels(selectedPreset.value, preset.url)) {
    clearModels();
  }

  applyPresetToForm(preset);
}

// 初始化
onMounted(() => {
  loadPresets();
  loadSelectedPreset();
  loadModels();
  initializePresetForm();
});

// 监听当前预设变化
onPresetChange((preset) => {
  applyPresetToForm(preset);

  // 切换预设时清空模型列表
  clearModels();
});

// 监听 URL 变化
watch(urlInput, (newUrl, oldUrl) => {
  // URL 变化时清空模型列表（除了初始化时）
  if (oldUrl !== undefined && newUrl !== oldUrl) {
    clearModels();
  }
});

// 保存当前预设
function handleSaveCurrentPreset() {
  saveCurrentPreset(getFormData());
  // 更新原始数据
  updateOriginalData();
  // 显示成功通知
  const msg = getNotificationMessage('API_PRESET_SAVE_SUCCESS');
  showSuccess(msg.title, msg.message);
}

// 创建新预设
function handleCreateNewPreset() {
  createNewPreset();
}

// 处理返回按钮点击
function handleBack() {
  checkBeforeLeave(() => router.back());
}

// 保存并退出
async function onSaveAndExit() {
  await handleSaveAndLeave(() => {
    handleSaveCurrentPreset();
    router.back();
  });
}

// 不保存直接退出
function onDiscardAndExit() {
  handleDiscardAndLeave();
  router.back();
}

// 取消退出
function onCancelExit() {
  handleCancelLeave();
}

// 获取模型列表
async function handleFetchModels() {
  try {
    const count = await fetchModels(urlInput.value, apiKeyInput.value, {
      enabled: proxyEnabled.value,
      proxyUrl: proxyUrl.value,
      type: proxyType.value,
      targetEndpoint: proxyTargetEndpoint.value,
    });
    if (count !== undefined) {
      saveModels(selectedPreset.value, urlInput.value);
      const msg = getNotificationMessage('API_PRESET_LOAD_SUCCESS', { count });
      showSuccess(msg.title, msg.message);
    }
  } catch (error) {
    const msg = getNotificationMessage('API_PRESET_LOAD_FAILED', {
      error: error instanceof Error ? error.message : '获取模型列表失败'
    });
    showError(msg.title, msg.message);
  }
}

// 测试连接
async function handleTestConnection() {
  try {
    const latency = await testConnection(urlInput.value, apiKeyInput.value, {
      enabled: proxyEnabled.value,
      proxyUrl: proxyUrl.value,
      type: proxyType.value,
      targetEndpoint: proxyTargetEndpoint.value,
    });
    const msg = getNotificationMessage('API_PRESET_CONNECTION_SUCCESS', { latency });
    showSuccess(msg.title, msg.message);
  } catch (error) {
    const msg = getNotificationMessage('API_PRESET_CONNECTION_FAILED', {
      error: error instanceof Error ? error.message : '连接测试失败'
    });
    showError(msg.title, msg.message);
  }
}
</script>

<template>
  <div class="api-preset-page">
    <!-- 顶部导航栏 -->
    <PageHeader
      title="API预设"
      subtitle="API Preset"
      :show-back="true"
      :show-action="true"
      :action-icon="Save"
      @back="handleBack"
      @action="handleSaveCurrentPreset"
    />

    <!-- 预设选择器 -->
    <PresetSelector
      :presets="presets"
      :selected-preset-id="selectedPreset"
      @select="selectPreset"
      @rename="openRenameDialog"
      @delete="deletePreset"
      @create-new="openCreateNewDialog"
    />

    <!-- 滚动内容区域 -->
    <div class="content-scroll">
      <!-- API 配置 -->
      <ApiConfigForm
        :url="urlInput"
        :api-key="apiKeyInput"
        :proxy="{
          enabled: proxyEnabled,
          url: proxyUrl,
          type: proxyType,
          targetEndpoint: proxyTargetEndpoint,
        }"
        @update:url="urlInput = $event"
        @update:api-key="apiKeyInput = $event"
        @update:proxy="($event) => {
          proxyEnabled = $event.enabled;
          proxyUrl = $event.url;
          proxyType = $event.type;
          proxyTargetEndpoint = $event.targetEndpoint || '';
        }"
      />

      <!-- 模型配置 -->
      <ModelSelector
        :models="models"
        :selected-model="selectedModel"
        :model-input="modelInput"
        :is-loading="isLoadingModels"
        @update:selected-model="selectedModel = $event"
        @update:model-input="modelInput = $event"
        @fetch-models="handleFetchModels"
      />

      <!-- 连接测试 -->
      <div class="section">
        <div class="section-title">
          <Zap :size="18" />
          <span>连接测试</span>
        </div>
        <button class="test-btn" @click="handleTestConnection" :disabled="isTestingConnection">
          <RefreshCw :size="18" :class="{ 'spinning': isTestingConnection }" />
          <span>{{ isTestingConnection ? '测试中...' : '测试连接' }}</span>
        </button>
      </div>

      <!-- 参数设置 -->
      <ParameterSettings
        :stream-enabled="streamEnabled"
        :temperature="temperature"
        :max-tokens="maxTokens"
        :max-output-tokens="maxOutputTokens"
        @update:stream-enabled="streamEnabled = $event"
        @update:temperature="temperature = $event"
        @update:max-tokens="maxTokens = $event"
        @update:max-output-tokens="maxOutputTokens = $event"
      />
    </div>

    <!-- 新建预设对话框 -->
    <Modal
      v-model:show="showNewPresetDialog"
      title="新建预设"
      size="sm"
    >
      <div class="form-group">
        <label class="form-label">预设名称</label>
        <input
          v-model="newPresetName"
          type="text"
          class="form-input"
          placeholder="输入预设名称..."
          @keydown.enter="handleCreateNewPreset"
        />
      </div>
      <template #footer>
        <button class="modal-btn secondary" @click="showNewPresetDialog = false">取消</button>
        <button class="modal-btn primary" :disabled="!canCreatePreset" @click="handleCreateNewPreset">创建</button>
      </template>
    </Modal>

    <!-- 重命名对话框 -->
    <Modal
      v-model:show="showRenameDialog"
      title="重命名预设"
      size="sm"
    >
      <div class="form-group">
        <label class="form-label">预设名称</label>
        <input
          v-model="renamePresetName"
          type="text"
          class="form-input"
          placeholder="输入新名称..."
          @keydown.enter="renamePreset"
        />
      </div>
      <template #footer>
        <button class="modal-btn secondary" @click="showRenameDialog = false">取消</button>
        <button class="modal-btn primary" :disabled="!canRenamePreset" @click="renamePreset">确定</button>
      </template>
    </Modal>


    <!-- 删除确认对话框 -->
    <ConfirmDialog
      v-bind="confirmDialogProps"
      @confirm="handleConfirmDelete"
      @cancel="cancelDelete"
    />

    <!-- 退出确认对话框 -->
    <Modal
      v-model:show="showLeaveConfirm"
      :title="leaveConfirmDialogProps.title"
      size="sm"
    >
      <div class="exit-confirm-content">
        <div class="exit-confirm-icon">
          <AlertTriangle :size="32" />
        </div>
        <div class="exit-confirm-text">
          {{ leaveConfirmDialogProps.description }}
        </div>
      </div>
      <template #footer>
        <button class="modal-btn secondary" @click="onDiscardAndExit">{{ leaveConfirmDialogProps.thirdButtonText }}</button>
        <button class="modal-btn secondary" @click="onCancelExit">{{ leaveConfirmDialogProps.cancelText }}</button>
        <button class="modal-btn primary" @click="onSaveAndExit">{{ leaveConfirmDialogProps.confirmText }}</button>
      </template>
    </Modal>
  </div>
</template>

<style scoped>
.api-preset-page {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
  overflow: hidden;
  position: relative;
}

/* 内容滚动区域 */
.content-scroll {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 14px 16px;
}

/* 分组 */
.section {
  margin-bottom: 20px;
}

.section:last-child {
  margin-bottom: 0;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-muted);
  margin-bottom: 14px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* 表单元素 */
.form-group {
  margin-bottom: 14px;
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

.form-input {
  width: 100%;
  padding: 11px 13px;
  background: var(--bg-secondary);
  border: 1.5px solid var(--border-color);
  border-radius: 10px;
  color: var(--text-main);
  font-size: 14px;
  transition: all 0.2s ease;
  outline: none;
}

.form-input::placeholder {
  color: var(--text-muted);
  opacity: 0.5;
}

.form-input:focus {
  border-color: var(--accent-purple);
}

/* 测试按钮 */
.test-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 13px;
  background: var(--accent-purple);
  border: none;
  border-radius: 10px;
  color: white;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.test-btn:active:not(:disabled) {
  transform: scale(0.98);
  opacity: 0.9;
}

.test-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* Toast 提示 */


/* 退出确认对话框样式 */
.exit-confirm-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 8px 0;
}

.exit-confirm-icon {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: rgba(245, 158, 11, 0.12);
  color: #f59e0b;
  display: flex;
  align-items: center;
  justify-content: center;
}

.exit-confirm-text {
  font-size: 15px;
  color: var(--text-main);
  text-align: center;
  line-height: 1.5;
}
</style>