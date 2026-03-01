/**
 * 模型 API Composable
 *
 * 使用新的 API 服务层提供模型管理功能
 */

import { ref } from 'vue';
import type { Model } from '../types';
import { DEFAULT_MODELS, getModelById } from '../data/modelData';
import { STORAGE_KEYS, DEFAULTS } from '../constants';
import { ModelsApi, type ApiClientConfig, type ProxyConfig } from '@/api';
import { getStorage, setStorage } from '@/utils/storage';

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
   */
  async function loadModels() {
    const saved = await getStorage<{ models: Model[]; presetId: string; url: string }>(
      STORAGE_KEYS.MODELS,
      { models: [], presetId: '', url: '' }
    );
    if (saved && saved.models && Array.isArray(saved.models)) {
      models.value = saved.models;
      modelsAssociatedPreset.value = saved.presetId || '';
      modelsAssociatedUrl.value = saved.url || '';
    }
  }

  /**
   * 保存模型列表
   */
  async function saveModels(presetId: string, url: string) {
    await setStorage(STORAGE_KEYS.MODELS, {
      models: models.value,
      presetId,
      url,
    });
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
    proxy?: { enabled: boolean; proxyUrl: string; type: 'query' | 'header'; targetEndpoint?: string }
  ): Promise<number> {
    const proxyConfig: ProxyConfig | undefined = proxy?.enabled ? {
      enabled: proxy.enabled,
      url: proxy.proxyUrl,
      type: proxy.type,
      targetEndpoint: proxy.targetEndpoint,
    } : undefined;

    const config: ApiClientConfig = {
      baseURL: url,
      apiKey,
      timeout: 30000, // 30 秒超时
      maxRetries: 2, // 获取模型列表重试 2 次
      retryDelay: 1000,
      proxy: proxyConfig,
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