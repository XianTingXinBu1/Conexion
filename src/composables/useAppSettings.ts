/**
 * 应用设置管理 Composable
 *
 * 管理应用的所有设置项，包括聊天设置、提示词设置等
 */

import { ref } from 'vue';
import { useLocalStorage } from './useLocalStorage';
import { STORAGE_KEYS, DEFAULTS } from '@/constants';
import type { MergeMode } from '@/modules/system-prompt';

/**
 * 应用设置接口
 */
export interface AppSettings {
  // 聊天设置
  enterToSend: boolean;
  showWordCount: boolean;
  enableMarkdown: boolean;
  showMessageIndex: boolean;
  chatHistoryLimit: number;

  // 提示词设置
  promptMergeMode: MergeMode;
}

/**
 * 应用设置管理
 */
export function useAppSettings() {
  // 聊天设置
  const { value: enterToSend } = useLocalStorage(STORAGE_KEYS.ENTER_TO_SEND, true);
  const { value: showWordCount } = useLocalStorage(STORAGE_KEYS.SHOW_WORD_COUNT, false);
  const { value: enableMarkdown } = useLocalStorage(STORAGE_KEYS.ENABLE_MARKDOWN, true);
  const { value: showMessageIndex } = useLocalStorage(STORAGE_KEYS.SHOW_MESSAGE_INDEX, false);
  const { value: chatHistoryLimit } = useLocalStorage(STORAGE_KEYS.CHAT_HISTORY_LIMIT, DEFAULTS.CHAT_HISTORY_LIMIT);

  // 提示词设置
  const { value: promptMergeMode } = useLocalStorage<MergeMode>(
    STORAGE_KEYS.PROMPT_MERGE_MODE,
    DEFAULTS.PROMPT_MERGE_MODE
  );

  // 设置更新方法
  const updateEnterToSend = (value: boolean) => {
    enterToSend.value = value;
  };

  const updateShowWordCount = (value: boolean) => {
    showWordCount.value = value;
  };

  const updateEnableMarkdown = (value: boolean) => {
    enableMarkdown.value = value;
  };

  const updateShowMessageIndex = (value: boolean) => {
    showMessageIndex.value = value;
  };

  const updateChatHistoryLimit = (value: number) => {
    chatHistoryLimit.value = value;
  };

  const updatePromptMergeMode = (value: MergeMode) => {
    promptMergeMode.value = value;
  };

  /**
   * 恢复默认设置
   */
  const restoreDefaults = async () => {
    const { setStorage } = await import('@/utils/storage');
    await setStorage(STORAGE_KEYS.ENTER_TO_SEND, true);
    await setStorage(STORAGE_KEYS.SHOW_WORD_COUNT, false);
    await setStorage(STORAGE_KEYS.ENABLE_MARKDOWN, true);
    await setStorage(STORAGE_KEYS.SHOW_MESSAGE_INDEX, DEFAULTS.SHOW_MESSAGE_INDEX);
    await setStorage(STORAGE_KEYS.CHAT_HISTORY_LIMIT, DEFAULTS.CHAT_HISTORY_LIMIT);
    await setStorage(STORAGE_KEYS.MERGE_PROMPT_PRESETS, DEFAULTS.MERGE_PROMPT_PRESETS);
    await setStorage(STORAGE_KEYS.PROMPT_MERGE_MODE, DEFAULTS.PROMPT_MERGE_MODE);
    await setStorage(STORAGE_KEYS.DEBUG_MODE, DEFAULTS.DEBUG_MODE);
    location.reload();
  };

  /**
   * 获取所有设置（只读）
   */
  const settings = ref<AppSettings>({
    enterToSend: enterToSend.value,
    showWordCount: showWordCount.value,
    enableMarkdown: enableMarkdown.value,
    showMessageIndex: showMessageIndex.value,
    chatHistoryLimit: chatHistoryLimit.value,
    promptMergeMode: promptMergeMode.value,
  });

  return {
    // 聊天设置
    enterToSend,
    showWordCount,
    enableMarkdown,
    showMessageIndex,
    chatHistoryLimit,

    // 提示词设置
    promptMergeMode,

    // 更新方法
    updateEnterToSend,
    updateShowWordCount,
    updateEnableMarkdown,
    updateShowMessageIndex,
    updateChatHistoryLimit,
    updatePromptMergeMode,

    // 其他方法
    restoreDefaults,
    settings,
  };
}