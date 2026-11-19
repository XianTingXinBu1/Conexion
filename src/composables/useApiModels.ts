/**
 * 模型 API Composable
 *
 * 使用新的 API 服务层提供模型管理功能
 */

import { ref } from 'vue';
import type { Model } from '@/types';
import { DEFAULT_MODELS, getModelById } from '../data/modelData';
import { SETTING_KEYS, DEFAULTS } from '../constants';
import { ModelsApi, type ApiClientConfig } from '@/api';
import { getSetting, setSetting } from '@/repositories/settingsRepository';
import { generalLogger } from '@/modules/debug';

export function useApiModels() {
  // 模型相关状态
  const models = ref<Model[]>(DEFAULT_MODELS);
  const selectedModel = ref<string>(DEFAULTS.MODEL);
  const modelInput = ref('');
  const isLoadingModels = ref(false);

  // 模型列表关联的预设 ID 和 URL（用于判断是否需要清空）
  const modelsAssociatedPreset = ref<string>('');
  const modelsAssociatedUrl = ref<string>('');

  /**
   * 加载模型列表
   *
   * 默认值传 null 而不是空对象：空数组 `[]` 既是真值又是合法数组，
   * 首次运行（后端还没存过）时会把 DEFAULT_MODELS 覆盖成空列表。
   */
  async function loadModels() {
    let saved: { models: Model[]; presetId: string; url: string } | null = null;

    try {
      saved = await getSetting<{ models: Model[]; presetId: string; url: string } | null>(
        SETTING_KEYS.MODELS,
        null
      );
    } catch (error) {
      // 调用方（页面 onMounted）是「发起后不 await」，这里不捕获就是未处理的 rejection，
      // 而且模型列表会停在不一致的状态
      const msg = error instanceof Error ? error.message : String(error);
      generalLogger.error('加载模型列表失败，回退到默认模型', { error: msg });
      return;
    }

    if (!saved) {
      return;
    }

    if (Array.isArray(saved.models) && saved.models.length > 0) {
      models.value = saved.models;
    }
    modelsAssociatedPreset.value = saved.presetId || '';
    modelsAssociatedUrl.value = saved.url || '';
  }

  /**
   * 保存模型列表
   *
   * 同时更新内存里的关联预设/URL：否则刚保存成功后
   * shouldClearModels(同一 presetId, 同一 url) 仍会返回 true，
   * 切换预设时会把刚保存的模型列表误清空。
   */
  async function saveModels(presetId: string, url: string) {
    await setSetting(SETTING_KEYS.MODELS, {
      models: models.value,
      presetId,
      url,
    });

    modelsAssociatedPreset.value = presetId;
    modelsAssociatedUrl.value = url;
  }

  /**
   * 清空模型列表
   */
  function clearModels() {
    models.value = [];
    modelsAssociatedPreset.value = '';
    modelsAssociatedUrl.value = '';
  }

  /**
   * 检查模型列表是否需要清空
   */
  function shouldClearModels(currentPresetId: string, currentUrl: string): boolean {
    return (
      modelsAssociatedPreset.value !== currentPresetId ||
      modelsAssociatedUrl.value !== currentUrl
    );
  }

  /**
   * 更新模型输入显示
   */
  function updateModelInput() {
    if (selectedModel.value) {
      const model = getModelById(selectedModel.value, models.value);
      modelInput.value = model?.name || selectedModel.value;
    }
  }

  /**
   * 重置模型选择
   */
  function resetModelSelection() {
    selectedModel.value = DEFAULTS.MODEL;
    modelInput.value = getModelById(DEFAULTS.MODEL, models.value)?.name || DEFAULTS.MODEL;
  }

  /**
   * 获取模型列表
   */
  async function fetchModels(
    url: string,
    apiKey: string,
  ): Promise<number> {
    const config: ApiClientConfig = {
      baseURL: url,
      apiKey,
      timeout: 30000,
    };

    const modelsApi = new ModelsApi(config);
    isLoadingModels.value = true;

    try {
      const fetchedModels = await modelsApi.getModels();
      models.value = fetchedModels;

      return models.value.length;
    } catch (error) {
      let errorMessage = '获取模型列表失败';
      if (error instanceof Error) {
        errorMessage = error.message;
      }

      throw new Error(errorMessage);
    } finally {
      isLoadingModels.value = false;
    }
  }

  return {
    // 状态
    models,
    selectedModel,
    modelInput,
    isLoadingModels,
    modelsAssociatedPreset,
    modelsAssociatedUrl,

    // 方法
    loadModels,
    saveModels,
    clearModels,
    shouldClearModels,
    updateModelInput,
    resetModelSelection,
    fetchModels,
  };
}