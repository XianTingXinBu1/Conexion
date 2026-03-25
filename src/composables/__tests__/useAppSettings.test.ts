import { describe, expect, it, vi } from 'vitest';
import { APP_SETTINGS_DEFAULTS, writeAppSettingsDefaults } from '../useAppSettings';
import { STORAGE_KEYS } from '@/constants';

describe('useAppSettings helpers', () => {
  it('exposes shared defaults for settings pages and composables', () => {
    expect(APP_SETTINGS_DEFAULTS).toEqual({
      enterToSend: true,
      showWordCount: false,
      enableMarkdown: true,
      showMessageIndex: false,
      chatHistoryLimit: 20,
      promptMergeMode: 'adjacent',
      mergePromptPresets: true,
      debugMode: false,
    });
  });

  it('writes default settings through the provided storage writer', async () => {
    const write = vi.fn(async () => undefined);

    await writeAppSettingsDefaults(write as never);

    expect(write.mock.calls).toEqual([
      [STORAGE_KEYS.ENTER_TO_SEND, true],
      [STORAGE_KEYS.SHOW_WORD_COUNT, false],
      [STORAGE_KEYS.ENABLE_MARKDOWN, true],
      [STORAGE_KEYS.SHOW_MESSAGE_INDEX, false],
      [STORAGE_KEYS.CHAT_HISTORY_LIMIT, 20],
      [STORAGE_KEYS.MERGE_PROMPT_PRESETS, true],
      [STORAGE_KEYS.PROMPT_MERGE_MODE, 'adjacent'],
      [STORAGE_KEYS.DEBUG_MODE, false],
    ]);
  });
});
