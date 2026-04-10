import { ref, computed, watch } from 'vue';
import type { Preset, PresetFormData } from './types';
import { STORAGE_KEYS, DEFAULT_API_PRESETS, DEFAULTS } from '../../constants';
import { useConfirmDialog } from '../../composables/useConfirmDialog';
import { useNotifications } from '../notification';
import { getStorage, setStorage } from '@/utils/storage';

const DEFAULT_PRESET_FORM_DATA: PresetFormData = {
  url: '',
  apiKey: '',
  model: '',
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
};

function cloneDefaultPresetFormData(): PresetFormData {
  return {
    ...DEFAULT_PRESET_FORM_DATA,
    proxy: { ...DEFAULT_PRESET_FORM_DATA.proxy },
  };
}

function mapPresetToFormData(preset: Preset): PresetFormData {
  return {
    ...cloneDefaultPresetFormData(),
    url: preset.url,
    apiKey: preset.apiKey,
    model: preset.model,
    streamEnabled: preset.streamEnabled,
    temperature: preset.temperature,
    maxTokens: preset.maxTokens,
    maxOutputTokens: preset.maxOutputTokens,
    proxy: preset.proxy
      ? {
          enabled: preset.proxy.enabled,
          url: preset.proxy.url,
          type: preset.proxy.type,
          targetEndpoint: preset.proxy.targetEndpoint || '',
        }
      : cloneDefaultPresetFormData().proxy,
  };
}

/**
 * API 预设管理 Composable
 * 提供预设的加载、保存、选择、创建、删除、重命名等功能
 */
export function useApiPresets() {
  const { confirmDialogProps, showDeleteConfirm, confirmDelete, cancelDelete, ConfirmDialog } = useConfirmDialog();
  const { showSuccess, showError } = useNotifications();

  // 预设相关状态
  const presets = ref<Preset[]>([...DEFAULT_API_PRESETS]);
  const selectedPreset = ref<string>('default');
  const showNewPresetDialog = ref(false);
  const showRenameDialog = ref(false);
  const newPresetName = ref('');
  const renamePresetId = ref('');
  const renamePresetName = ref('');

  // 计算属性
  const currentPreset = computed(() => presets.value.find(p => p.id === selectedPreset.value));
  const canCreatePreset = computed(() => newPresetName.value.trim());
  const canRenamePreset = computed(() => renamePresetName.value.trim());

  // 标志位：是否跳过 watch
  let skipWatch = false;

  // 加载预设
  async function loadPresets() {
    const saved = await getStorage<Preset[]>(STORAGE_KEYS.API_PRESETS, [...DEFAULT_API_PRESETS]);
    if (saved && Array.isArray(saved) && saved.length > 0) {
      presets.value = saved;
    }
  }

  // 保存预设
  async function savePresets() {
    await setStorage(STORAGE_KEYS.API_PRESETS, presets.value);
    console.log('[useApiPresets] 已保存预设列表，数量:', presets.value.length);
    console.log('[useApiPresets] 预设IDs:', presets.value.map(p => p.id));
  }

  // 加载选中的预设
  async function loadSelectedPreset() {
    const saved = await getStorage<string>(STORAGE_KEYS.SELECTED_PRESET, '');
    if (saved) {
      const exists = presets.value.find(p => p.id === saved);
      if (exists) {
        selectedPreset.value = saved;
        console.log('[useApiPresets] 加载选中的预设:', saved);
        return;
      }
    }

    // 如果没有保存的预设或预设不存在，默认选择第一个预设
    if (presets.value.length > 0) {
      selectedPreset.value = presets.value[0]!.id;
      await saveSelectedPreset(selectedPreset.value);
      console.log('[useApiPresets] 未找到选中的预设，默认选择:', selectedPreset.value);
    }
  }

  // 保存选中的预设
  async function saveSelectedPreset(presetId: string) {
    await setStorage(STORAGE_KEYS.SELECTED_PRESET, presetId);
  }

  // 选择预设
  async function selectPreset(presetId: string) {
    selectedPreset.value = presetId;
    await saveSelectedPreset(presetId);
  }

  // 保存当前预设
  async function saveCurrentPreset(formData: PresetFormData) {
    console.log('[useApiPresets] ===== 开始保存预设 =====');
    console.log('[useApiPresets] 选中的预设ID:', selectedPreset.value);
    console.log('[useApiPresets] 表单数据:', {
      url: formData.url,
      hasApiKey: !!formData.apiKey,
      model: formData.model,
      hasModel: !!formData.model,
      streamEnabled: formData.streamEnabled,
      temperature: formData.temperature,
      maxTokens: formData.maxTokens,
      maxOutputTokens: formData.maxOutputTokens,
      proxyEnabled: formData.proxy.enabled,
      proxyUrl: formData.proxy.url,
      proxyType: formData.proxy.type,
      proxyTargetEndpoint: formData.proxy.targetEndpoint
    });

    const presetIndex = presets.value.findIndex(p => p.id === selectedPreset.value);
    if (presetIndex !== -1) {
      const existing = presets.value[presetIndex]!;
      presets.value[presetIndex] = {
        id: existing.id,
        name: existing.name,
        createdAt: existing.createdAt,
        url: formData.url,
        apiKey: formData.apiKey,
        model: formData.model,
        streamEnabled: formData.streamEnabled,
        temperature: formData.temperature,
        maxTokens: formData.maxTokens,
        maxOutputTokens: formData.maxOutputTokens,
        proxy: formData.proxy,
        updatedAt: Date.now(),
      };
      await savePresets();
      // 确保选中的预设 ID 也被保存
      await saveSelectedPreset(selectedPreset.value);
      console.log('[useApiPresets] ✓ 预设已保存到 localStorage');
      console.log('[useApiPresets] 保存后的预设数据:', presets.value[presetIndex]);
    } else {
      console.error('[useApiPresets] 错误：未找到要更新的预设，预设ID:', selectedPreset.value);
    }
    console.log('[useApiPresets] ===== 预设保存完成 =====');
  }

  // 创建新预设
  async function createNewPreset(formData: PresetFormData = cloneDefaultPresetFormData()) {
    if (!newPresetName.value.trim()) {
      return;
    }

    const newPreset: Preset = {
      id: Date.now().toString(),
      name: newPresetName.value,
      url: formData.url,
      apiKey: formData.apiKey,
      model: formData.model,
      streamEnabled: formData.streamEnabled,
      temperature: formData.temperature,
      maxTokens: formData.maxTokens,
      maxOutputTokens: formData.maxOutputTokens,
      proxy: formData.proxy,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    console.log('[useApiPresets] ===== 创建新预设 =====');
    console.log('[useApiPresets] 新预设数据:', newPreset);

    presets.value.push(newPreset);
    await savePresets();
    selectedPreset.value = newPreset.id;
    await saveSelectedPreset(newPreset.id);
    newPresetName.value = '';
    showNewPresetDialog.value = false;

    console.log('[useApiPresets] 新预设已创建，ID:', newPreset.id);
    console.log('[useApiPresets] 当前选中的预设ID:', selectedPreset.value);

    showSuccess('创建成功', '预设已创建');
  }

  // 删除预设
  function deletePreset(presetId: string) {
    if (presets.value.length <= 1) {
      showError('无法删除', '至少需要保留一个预设');
      return;
    }

    const preset = presets.value.find(p => p.id === presetId);
    if (preset) {
      showDeleteConfirm(presetId, preset.name, '预设');
    }
  }

  // 处理删除确认
  async function handleConfirmDelete() {
    const id = confirmDelete();
    if (!id) return;

    const index = presets.value.findIndex(p => p.id === id);
    if (index !== -1) {
      presets.value.splice(index, 1);
      if (selectedPreset.value === id) {
        if (presets.value.length > 0) {
          selectedPreset.value = presets.value[0]!.id;
        }
      }
      await savePresets();
      showSuccess('删除成功', '预设已删除');
    }
  }

  // 打开重命名对话框
  function openRenameDialog(presetId: string) {
    const preset = presets.value.find(p => p.id === presetId);
    if (preset) {
      renamePresetId.value = presetId;
      renamePresetName.value = preset.name;
      showRenameDialog.value = true;
    }
  }

  // 重命名预设
  async function renamePreset() {
    if (!renamePresetName.value.trim()) {
      return;
    }

    const index = presets.value.findIndex(p => p.id === renamePresetId.value);
    if (index !== -1) {
      const preset = presets.value[index]!;
      preset.name = renamePresetName.value;
      preset.updatedAt = Date.now();
      await savePresets();
      renamePresetName.value = '';
      showRenameDialog.value = false;
      showSuccess('重命名成功', '预设已重命名');
    }
  }

  // 打开新建预设对话框
  function openCreateNewDialog() {
    showNewPresetDialog.value = true;
  }

  // 加载预设到表单
  function loadPresetToForm(preset: Preset): PresetFormData {
    return mapPresetToFormData(preset);
  }

  // 监听预设变化
  function onPresetChange(callback: (preset: Preset) => void) {
    watch(currentPreset, (preset) => {
      if (preset && !skipWatch) {
        callback(preset);
      }
    }, { flush: 'post' });
  }

  return {
    // 状态
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

    // 方法
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
    createDefaultPresetFormData: cloneDefaultPresetFormData,
    cancelDelete,
    onPresetChange,
  };
}