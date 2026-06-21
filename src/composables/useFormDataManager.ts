import { ref, computed } from 'vue';

interface FormData {
  url: string;
  apiKey: string;
  model: string;
  streamEnabled: boolean;
  temperature: number;
  maxTokens: number;
  maxOutputTokens: number;
}

interface FormDataManagerOptions {
  initialData?: Partial<FormData>;
}

export function useFormDataManager(options: FormDataManagerOptions = {}) {
  const { initialData } = options;

  const urlInput = ref(initialData?.url ?? '');
  const apiKeyInput = ref(initialData?.apiKey ?? '');
  const modelInput = ref(initialData?.model ?? '');
  const streamEnabled = ref(initialData?.streamEnabled ?? false);
  const temperature = ref(initialData?.temperature ?? 0.7);
  const maxTokens = ref(initialData?.maxTokens ?? 4000);
  const maxOutputTokens = ref(initialData?.maxOutputTokens ?? 1000);

  const originalData = ref<FormData>({
    url: initialData?.url ?? '',
    apiKey: initialData?.apiKey ?? '',
    model: initialData?.model ?? '',
    streamEnabled: initialData?.streamEnabled ?? false,
    temperature: initialData?.temperature ?? 0.7,
    maxTokens: initialData?.maxTokens ?? 4000,
    maxOutputTokens: initialData?.maxOutputTokens ?? 1000,
  });

  const hasUnsavedChanges = computed(() => {
    return (
      urlInput.value !== originalData.value.url ||
      apiKeyInput.value !== originalData.value.apiKey ||
      modelInput.value !== originalData.value.model ||
      streamEnabled.value !== originalData.value.streamEnabled ||
      temperature.value !== originalData.value.temperature ||
      maxTokens.value !== originalData.value.maxTokens ||
      maxOutputTokens.value !== originalData.value.maxOutputTokens
    );
  });

  function updateOriginalData() {
    originalData.value = {
      url: urlInput.value,
      apiKey: apiKeyInput.value,
      model: modelInput.value,
      streamEnabled: streamEnabled.value,
      temperature: temperature.value,
      maxTokens: maxTokens.value,
      maxOutputTokens: maxOutputTokens.value,
    };
  }

  function getFormData(): FormData {
    return {
      url: urlInput.value,
      apiKey: apiKeyInput.value,
      model: modelInput.value,
      streamEnabled: streamEnabled.value,
      temperature: temperature.value,
      maxTokens: maxTokens.value,
      maxOutputTokens: maxOutputTokens.value,
    };
  }

  function resetFormData(data: Partial<FormData> = {}) {
    urlInput.value = data.url ?? '';
    apiKeyInput.value = data.apiKey ?? '';
    modelInput.value = data.model ?? '';
    streamEnabled.value = data.streamEnabled ?? false;
    temperature.value = data.temperature ?? 0.7;
    maxTokens.value = data.maxTokens ?? 4000;
    maxOutputTokens.value = data.maxOutputTokens ?? 1000;
  }

  function loadFormData(data: FormData) {
    urlInput.value = data.url;
    apiKeyInput.value = data.apiKey;
    modelInput.value = data.model;
    streamEnabled.value = data.streamEnabled;
    temperature.value = data.temperature;
    maxTokens.value = data.maxTokens;
    maxOutputTokens.value = data.maxOutputTokens;
  }

  return {
    urlInput,
    apiKeyInput,
    modelInput,
    streamEnabled,
    temperature,
    maxTokens,
    maxOutputTokens,
    hasUnsavedChanges,
    updateOriginalData,
    getFormData,
    resetFormData,
    loadFormData,
  };
}
