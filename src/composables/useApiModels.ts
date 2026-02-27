import { ref } from 'vue';
import type { Model } from '../types';
import { DEFAULT_MODELS, getModelById } from '../data/modelData';
import { STORAGE_KEYS, DEFAULTS } from '../constants';
import { validateUrl, getFriendlyErrorMessage } from '../utils';
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

  // 加载模型列表
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

  // 保存模型列表
  async function saveModels(presetId: string, url: string) {
    await setStorage(STORAGE_KEYS.MODELS, {
      models: models.value,
      presetId,
      url,
    });
  }

  // 清空模型列表
  function clearModels() {
    models.value = [];
    modelsAssociatedPreset.value = '';
    modelsAssociatedUrl.value = '';
  }

  // 检查模型列表是否需要清空
  function shouldClearModels(currentPresetId: string, currentUrl: string): boolean {
    return (
      modelsAssociatedPreset.value !== currentPresetId ||
      modelsAssociatedUrl.value !== currentUrl
    );
  }

  // 更新模型输入显示
  function updateModelInput() {
    if (selectedModel.value) {
      const model = getModelById(selectedModel.value, models.value);
      modelInput.value = model?.name || selectedModel.value;
    }
  }

  // 重置模型选择
  function resetModelSelection() {
    selectedModel.value = DEFAULTS.MODEL;
    modelInput.value = getModelById(DEFAULTS.MODEL, models.value)?.name || DEFAULTS.MODEL;
  }

  // 获取模型列表
  async function fetchModels(url: string, apiKey: string, proxy?: { enabled: boolean; proxyUrl: string; type: 'query' | 'header'; targetEndpoint?: string }) {
    // 验证 API URL
    const urlValidation = validateUrl(url);
    if (!urlValidation.valid) {
      throw new Error(urlValidation.error || 'URL 格式无效');
    }

    // 验证代理 URL（如果启用代理）
    if (proxy?.enabled) {
      if (!proxy.proxyUrl) {
        throw new Error('请先配置代理 URL');
      }

      const proxyUrlValidation = validateUrl(proxy.proxyUrl);
      if (!proxyUrlValidation.valid) {
        throw new Error(`代理 URL 无效：${proxyUrlValidation.error || '格式错误'}`);
      }

      // 验证目标端点（如果提供了）
      if (proxy.targetEndpoint) {
        const targetValidation = validateUrl(proxy.targetEndpoint);
        if (!targetValidation.valid) {
          throw new Error(`目标端点无效：${targetValidation.error || '格式错误'}`);
        }
      }
    }

    isLoadingModels.value = true;
    try {
      let requestUrl: string;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      // 只有当有 API Key 时才添加 Authorization 头
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }

      if (proxy?.enabled) {
        const proxyBaseUrl = proxy.proxyUrl.replace(/\/$/, '');
        const targetEndpoint = proxy.targetEndpoint || url.replace(/\/$/, '');

        if (proxy.type === 'query') {
          // 查询参数方式
          requestUrl = `${proxyBaseUrl}/models?endpoint=${encodeURIComponent(targetEndpoint)}`;
        } else {
          // 请求头方式
          headers['X-Target-Endpoint'] = targetEndpoint;
          requestUrl = `${proxyBaseUrl}/models`;
        }
      } else {
        // 不使用代理
        requestUrl = `${url.replace(/\/$/, '')}/models`;
      }

      // 添加超时控制
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时

      const response = await fetch(requestUrl, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        // 使用友好的错误消息
        const friendlyError = getFriendlyErrorMessage(errorText);
        throw new Error(`请求失败 (${response.status}): ${friendlyError || response.statusText}`);
      }

      const data = await response.json();

      // 支持多种响应格式
      let modelList: any[] = [];

      if (data.data && Array.isArray(data.data)) {
        // OpenAI 格式: { data: [{ id, ... }] }
        modelList = data.data;
      } else if (Array.isArray(data)) {
        // 直接返回数组格式: [{ id, ... }]
        modelList = data;
      } else if (data.models && Array.isArray(data.models)) {
        // 其他格式: { models: [{ id, ... }] }
        modelList = data.models;
      } else {
        throw new Error('响应格式无法识别');
      }

      if (modelList.length === 0) {
        throw new Error('未找到可用模型');
      }

      models.value = modelList.map((m: any) => ({
        id: m.id || m.name,
        name: m.name || m.id || m.model,
        description: m.description || '',
        contextLength: m.context_length || m.max_tokens || undefined,
      }));

      return models.value.length;
    } catch (error) {
      let errorMessage = '获取模型列表失败';
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          errorMessage = '请求超时，请检查网络连接';
        } else if (error.message.includes('Failed to fetch')) {
          errorMessage = '网络连接失败，请检查 URL 是否正确';
        } else {
          errorMessage = error.message;
        }
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