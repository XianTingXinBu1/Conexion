/**
 * 应用设置管理 Composable
 *
 * 管理应用的所有设置项，包括聊天设置、提示词设置等
 */

import { ref } from 'vue';
import { useLocalStorage } from './useLocalStorage';
import { STORAGE_KEYS, DEFAULTS } from '@/constants';
import type { MergeMode } from '@/modules/system-prompt';
import { setStorage } from '@/utils/storage';

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

export const APP_SETTINGS_DEFAULTS: AppSettings & {
  mergePromptPresets: typeof DEFAULTS.MERGE_PROMPT_PRESETS;
  debugMode: boolean;
} = {
  enterToSend: true,
  showWordCount: false,
  enableMarkdown: true,
  showMessageIndex: DEFAULTS.SHOW_MESSAGE_INDEX,
  chatHistoryLimit: DEFAULTS.CHAT_HISTORY_LIMIT,
  promptMergeMode: DEFAULTS.PROMPT_MERGE_MODE,
  mergePromptPresets: DEFAULTS.MERGE_PROMPT_PRESETS,
  debugMode: DEFAULTS.DEBUG_MODE,
} as const;

export function getAppSettingsSnapshot(): AppSettings {
  return {
    enterToSend: APP_SETTINGS_DEFAULTS.enterToSend,
    showWordCount: APP_SETTINGS_DEFAULTS.showWordCount,
    enableMarkdown: APP_SETTINGS_DEFAULTS.enableMarkdown,
    showMessageIndex: APP_SETTINGS_DEFAULTS.showMessageIndex,
    chatHistoryLimit: APP_SETTINGS_DEFAULTS.chatHistoryLimit,
    promptMergeMode: APP_SETTINGS_DEFAULTS.promptMergeMode,
  };
}

export async function writeAppSettingsDefaults(
  write: typeof setStorage = setStorage,
) {
  await write(STORAGE_KEYS.ENTER_TO_SEND, APP_SETTINGS_DEFAULTS.enterToSend);
  await write(STORAGE_KEYS.SHOW_WORD_COUNT, APP_SETTINGS_DEFAULTS.showWordCount);
  await write(STORAGE_KEYS.ENABLE_MARKDOWN, APP_SETTINGS_DEFAULTS.enableMarkdown);
  await write(STORAGE_KEYS.SHOW_MESSAGE_INDEX, APP_SETTINGS_DEFAULTS.showMessageIndex);
  await write(STORAGE_KEYS.CHAT_HISTORY_LIMIT, APP_SETTINGS_DEFAULTS.chatHistoryLimit);
  await write(STORAGE_KEYS.MERGE_PROMPT_PRESETS, APP_SETTINGS_DEFAULTS.mergePromptPresets);
  await write(STORAGE_KEYS.PROMPT_MERGE_MODE, APP_SETTINGS_DEFAULTS.promptMergeMode);
  await write(STORAGE_KEYS.DEBUG_MODE, APP_SETTINGS_DEFAULTS.debugMode);
}

/**
 * 应用设置管理
 */
export function useAppSettings() {
  // 聊天设置
  const { value: enterToSend } = useLocalStorage(STORAGE_KEYS.ENTER_TO_SEND, APP_SETTINGS_DEFAULTS.enterToSend);
  const { value: showWordCount } = useLocalStorage(STORAGE_KEYS.SHOW_WORD_COUNT, APP_SETTINGS_DEFAULTS.showWordCount);
  const { value: enableMarkdown } = useLocalStorage(STORAGE_KEYS.ENABLE_MARKDOWN, APP_SETTINGS_DEFAULTS.enableMarkdown);
  const { value: showMessageIndex } = useLocalStorage(STORAGE_KEYS.SHOW_MESSAGE_INDEX, APP_SETTINGS_DEFAULTS.showMessageIndex);
  const { value: chatHistoryLimit } = useLocalStorage(STORAGE_KEYS.CHAT_HISTORY_LIMIT, APP_SETTINGS_DEFAULTS.chatHistoryLimit);

  // 提示词设置
  const { value: promptMergeMode } = useLocalStorage<MergeMode>(
    STORAGE_KEYS.PROMPT_MERGE_MODE,
    APP_SETTINGS_DEFAULTS.promptMergeMode
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

  const applyDefaultRefs = () => {
    enterToSend.value = APP_SETTINGS_DEFAULTS.enterToSend;
    showWordCount.value = APP_SETTINGS_DEFAULTS.showWordCount;
    enableMarkdown.value = APP_SETTINGS_DEFAULTS.enableMarkdown;
    showMessageIndex.value = APP_SETTINGS_DEFAULTS.showMessageIndex;
    chatHistoryLimit.value = APP_SETTINGS_DEFAULTS.chatHistoryLimit;
    promptMergeMode.value = APP_SETTINGS_DEFAULTS.promptMergeMode;
  };

  const applyDefaults = async () => {
    await writeAppSettingsDefaults();
    applyDefaultRefs();
  };

  /**
   * 恢复默认设置
   */
  const restoreDefaults = async () => {
    await applyDefaults();
    location.reload();
  };

  /**
   * 获取所有设置（只读）
   */
  const settings = ref<AppSettings>(getAppSettingsSnapshot());
  settings.value = {
    enterToSend: enterToSend.value,
    showWordCount: showWordCount.value,
    enableMarkdown: enableMarkdown.value,
    showMessageIndex: showMessageIndex.value,
    chatHistoryLimit: chatHistoryLimit.value,
    promptMergeMode: promptMergeMode.value,
  };

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
    applyDefaults,
    restoreDefaults,
    settings,
  };
}
