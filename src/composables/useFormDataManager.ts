import { ref, computed } from 'vue';
import { DEFAULTS } from '../constants';

interface FormData {
  url: string;
  apiKey: string;
  model: string;
  streamEnabled: boolean;
  showThinking?: boolean;
  temperature: number;
  /** 核采样阈值（top_p）。 */
  topP: number;
  /** 频率惩罚（frequency_penalty）。 */
  frequencyPenalty: number;
  /** 存在惩罚（presence_penalty）。 */
  presencePenalty: number;
  /** 停止序列（stop），逐条对应 UI 里的一行。 */
  stopSequences: string[];
  /** 随机种子（seed）。未设置时由上游随机。 */
  seed?: number;
  /** 上下文窗口上限（token 数）。「最大上下文 Tokens」滑块的绑定字段。 */
  contextLength: number;
  maxOutputTokens: number;
}

interface FormDataManagerOptions {
  initialData?: Partial<FormData>;
}

/** 数组字段需要按内容比较，直接比引用会让「重新加载同一预设」被误判成有改动。 */
function sameStringArray(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((item, index) => item === b[index]);
}

export function useFormDataManager(options: FormDataManagerOptions = {}) {
  const { initialData } = options;

  const urlInput = ref(initialData?.url ?? '');
  const apiKeyInput = ref(initialData?.apiKey ?? '');
  const modelInput = ref(initialData?.model ?? '');
  const streamEnabled = ref(initialData?.streamEnabled ?? DEFAULTS.STREAM_ENABLED);
  const showThinking = ref(initialData?.showThinking ?? true);
  const temperature = ref(initialData?.temperature ?? DEFAULTS.TEMPERATURE);
  const topP = ref(initialData?.topP ?? DEFAULTS.TOP_P);
  const frequencyPenalty = ref(initialData?.frequencyPenalty ?? DEFAULTS.FREQUENCY_PENALTY);
  const presencePenalty = ref(initialData?.presencePenalty ?? DEFAULTS.PRESENCE_PENALTY);
  const stopSequences = ref<string[]>([...(initialData?.stopSequences ?? [])]);
  const seed = ref<number | undefined>(initialData?.seed);
  const contextLength = ref(initialData?.contextLength ?? DEFAULTS.CONTEXT_LENGTH);
  const maxOutputTokens = ref(initialData?.maxOutputTokens ?? DEFAULTS.MAX_OUTPUT_TOKENS);

  const originalData = ref<FormData>({
    url: initialData?.url ?? '',
    apiKey: initialData?.apiKey ?? '',
    model: initialData?.model ?? '',
    streamEnabled: initialData?.streamEnabled ?? DEFAULTS.STREAM_ENABLED,
    showThinking: initialData?.showThinking ?? true,
    temperature: initialData?.temperature ?? DEFAULTS.TEMPERATURE,
    topP: initialData?.topP ?? DEFAULTS.TOP_P,
    frequencyPenalty: initialData?.frequencyPenalty ?? DEFAULTS.FREQUENCY_PENALTY,
    presencePenalty: initialData?.presencePenalty ?? DEFAULTS.PRESENCE_PENALTY,
    stopSequences: [...(initialData?.stopSequences ?? [])],
    seed: initialData?.seed,
    contextLength: initialData?.contextLength ?? DEFAULTS.CONTEXT_LENGTH,
    maxOutputTokens: initialData?.maxOutputTokens ?? DEFAULTS.MAX_OUTPUT_TOKENS,
  });

  const hasUnsavedChanges = computed(() => {
    return (
      urlInput.value !== originalData.value.url ||
      apiKeyInput.value !== originalData.value.apiKey ||
      modelInput.value !== originalData.value.model ||
      streamEnabled.value !== originalData.value.streamEnabled ||
      showThinking.value !== (originalData.value.showThinking ?? true) ||
      temperature.value !== originalData.value.temperature ||
      topP.value !== originalData.value.topP ||
      frequencyPenalty.value !== originalData.value.frequencyPenalty ||
      presencePenalty.value !== originalData.value.presencePenalty ||
      !sameStringArray(stopSequences.value, originalData.value.stopSequences) ||
      seed.value !== originalData.value.seed ||
      contextLength.value !== originalData.value.contextLength ||
      maxOutputTokens.value !== originalData.value.maxOutputTokens
    );
  });

  function updateOriginalData() {
    originalData.value = {
      url: urlInput.value,
      apiKey: apiKeyInput.value,
      model: modelInput.value,
      streamEnabled: streamEnabled.value,
      showThinking: showThinking.value,
      temperature: temperature.value,
      topP: topP.value,
      frequencyPenalty: frequencyPenalty.value,
      presencePenalty: presencePenalty.value,
      stopSequences: [...stopSequences.value],
      seed: seed.value,
      contextLength: contextLength.value,
      maxOutputTokens: maxOutputTokens.value,
    };
  }

  function getFormData(): FormData {
    return {
      url: urlInput.value,
      apiKey: apiKeyInput.value,
      model: modelInput.value,
      streamEnabled: streamEnabled.value,
      showThinking: showThinking.value,
      temperature: temperature.value,
      topP: topP.value,
      frequencyPenalty: frequencyPenalty.value,
      presencePenalty: presencePenalty.value,
      stopSequences: [...stopSequences.value],
      seed: seed.value,
      contextLength: contextLength.value,
      maxOutputTokens: maxOutputTokens.value,
    };
  }

  function resetFormData(data: Partial<FormData> = {}) {
    urlInput.value = data.url ?? '';
    apiKeyInput.value = data.apiKey ?? '';
    modelInput.value = data.model ?? '';
    streamEnabled.value = data.streamEnabled ?? DEFAULTS.STREAM_ENABLED;
    showThinking.value = data.showThinking ?? true;
    temperature.value = data.temperature ?? DEFAULTS.TEMPERATURE;
    topP.value = data.topP ?? DEFAULTS.TOP_P;
    frequencyPenalty.value = data.frequencyPenalty ?? DEFAULTS.FREQUENCY_PENALTY;
    presencePenalty.value = data.presencePenalty ?? DEFAULTS.PRESENCE_PENALTY;
    stopSequences.value = [...(data.stopSequences ?? [])];
    seed.value = data.seed;
    contextLength.value = data.contextLength ?? DEFAULTS.CONTEXT_LENGTH;
    maxOutputTokens.value = data.maxOutputTokens ?? DEFAULTS.MAX_OUTPUT_TOKENS;
  }

  function loadFormData(data: FormData) {
    urlInput.value = data.url;
    apiKeyInput.value = data.apiKey;
    modelInput.value = data.model;
    streamEnabled.value = data.streamEnabled;
    showThinking.value = data.showThinking ?? true;
    temperature.value = data.temperature;
    topP.value = data.topP;
    frequencyPenalty.value = data.frequencyPenalty;
    presencePenalty.value = data.presencePenalty;
    stopSequences.value = [...data.stopSequences];
    seed.value = data.seed;
    contextLength.value = data.contextLength;
    maxOutputTokens.value = data.maxOutputTokens;
  }

  return {
    urlInput,
    apiKeyInput,
    modelInput,
    streamEnabled,
    showThinking,
    temperature,
    topP,
    frequencyPenalty,
    presencePenalty,
    stopSequences,
    seed,
    contextLength,
    maxOutputTokens,
    hasUnsavedChanges,
    updateOriginalData,
    getFormData,
    resetFormData,
    loadFormData,
  };
}
