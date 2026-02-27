import { ref, computed } from 'vue';

interface FormData {
  url: string;
  apiKey: string;
  model: string;
  streamEnabled: boolean;
  temperature: number;
  maxTokens: number;
  maxOutputTokens: number;
  proxy: {
    enabled: boolean;
    url: string;
    type: 'query' | 'header';
    targetEndpoint: string;
  };
}

interface FormDataManagerOptions {
  initialData?: Partial<FormData>;
}

/**
 * 表单数据管理 Composable
 *
 * 用于管理表单数据和检测未保存的更改
 *
 * @param options - 配置选项
 * @returns 表单数据管理相关的状态和方法
 */
export function useFormDataManager(options: FormDataManagerOptions = {}) {
  const { initialData } = options;

  // 表单数据
  const urlInput = ref(initialData?.url ?? '');
  const apiKeyInput = ref(initialData?.apiKey ?? '');
  const modelInput = ref(initialData?.model ?? '');
  const streamEnabled = ref(initialData?.streamEnabled ?? false);
  const temperature = ref(initialData?.temperature ?? 0.7);
  const maxTokens = ref(initialData?.maxTokens ?? 4000);
  const maxOutputTokens = ref(initialData?.maxOutputTokens ?? 1000);
  const proxyEnabled = ref(initialData?.proxy?.enabled ?? false);
  const proxyUrl = ref(initialData?.proxy?.url ?? '');
  const proxyType = ref<'query' | 'header'>(initialData?.proxy?.type ?? 'query');
  const proxyTargetEndpoint = ref(initialData?.proxy?.targetEndpoint ?? '');

  // 保存的原始数据（用于检测是否有未保存的更改）
  const originalData = ref<FormData>({
    url: initialData?.url ?? '',
    apiKey: initialData?.apiKey ?? '',
    model: initialData?.model ?? '',
    streamEnabled: initialData?.streamEnabled ?? false,
    temperature: initialData?.temperature ?? 0.7,
    maxTokens: initialData?.maxTokens ?? 4000,
    maxOutputTokens: initialData?.maxOutputTokens ?? 1000,
    proxy: {
      enabled: initialData?.proxy?.enabled ?? false,
      url: initialData?.proxy?.url ?? '',
      type: initialData?.proxy?.type ?? 'query',
      targetEndpoint: initialData?.proxy?.targetEndpoint ?? '',
    },
  });

  // 检测表单是否有未保存的更改
  const hasUnsavedChanges = computed(() => {
    return (
      urlInput.value !== originalData.value.url ||
      apiKeyInput.value !== originalData.value.apiKey ||
      modelInput.value !== originalData.value.model ||
      streamEnabled.value !== originalData.value.streamEnabled ||
      temperature.value !== originalData.value.temperature ||
      maxTokens.value !== originalData.value.maxTokens ||
      maxOutputTokens.value !== originalData.value.maxOutputTokens ||
      proxyEnabled.value !== originalData.value.proxy.enabled ||
      proxyUrl.value !== originalData.value.proxy.url ||
      proxyType.value !== originalData.value.proxy.type ||
      proxyTargetEndpoint.value !== originalData.value.proxy.targetEndpoint
    );
  });

  // 更新原始数据（在加载预设或保存后调用）
  function updateOriginalData() {
    originalData.value = {
      url: urlInput.value,
      apiKey: apiKeyInput.value,
      model: modelInput.value,
      streamEnabled: streamEnabled.value,
      temperature: temperature.value,
      maxTokens: maxTokens.value,
      maxOutputTokens: maxOutputTokens.value,
      proxy: {
        enabled: proxyEnabled.value,
        url: proxyUrl.value,
        type: proxyType.value,
        targetEndpoint: proxyTargetEndpoint.value,
      },
    };
  }

  // 获取当前表单数据
  function getFormData(): FormData {
    return {
      url: urlInput.value,
      apiKey: apiKeyInput.value,
      model: modelInput.value,
      streamEnabled: streamEnabled.value,
      temperature: temperature.value,
      maxTokens: maxTokens.value,
      maxOutputTokens: maxOutputTokens.value,
      proxy: {
        enabled: proxyEnabled.value,
        url: proxyUrl.value,
        type: proxyType.value,
        targetEndpoint: proxyTargetEndpoint.value,
      },
    };
  }

  // 重置表单数据
  function resetFormData(data: Partial<FormData> = {}) {
    urlInput.value = data.url ?? '';
    apiKeyInput.value = data.apiKey ?? '';
    modelInput.value = data.model ?? '';
    streamEnabled.value = data.streamEnabled ?? false;
    temperature.value = data.temperature ?? 0.7;
    maxTokens.value = data.maxTokens ?? 4000;
    maxOutputTokens.value = data.maxOutputTokens ?? 1000;
    proxyEnabled.value = data.proxy?.enabled ?? false;
    proxyUrl.value = data.proxy?.url ?? '';
    proxyType.value = data.proxy?.type ?? 'query';
    proxyTargetEndpoint.value = data.proxy?.targetEndpoint ?? '';
  }

  // 加载数据到表单
  function loadFormData(data: FormData) {
    urlInput.value = data.url;
    apiKeyInput.value = data.apiKey;
    modelInput.value = data.model;
    streamEnabled.value = data.streamEnabled;
    temperature.value = data.temperature;
    maxTokens.value = data.maxTokens;
    maxOutputTokens.value = data.maxOutputTokens;
    proxyEnabled.value = data.proxy?.enabled ?? false;
    proxyUrl.value = data.proxy?.url ?? '';
    proxyType.value = data.proxy?.type ?? 'query';
    proxyTargetEndpoint.value = data.proxy?.targetEndpoint ?? '';
  }

  return {
    // 表单数据状态
    urlInput,
    apiKeyInput,
    modelInput,
    streamEnabled,
    temperature,
    maxTokens,
    maxOutputTokens,
    proxyEnabled,
    proxyUrl,
    proxyType,
    proxyTargetEndpoint,

    // 计算属性
    hasUnsavedChanges,

    // 方法
    updateOriginalData,
    getFormData,
    resetFormData,
    loadFormData,
  };
}