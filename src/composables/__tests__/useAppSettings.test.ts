import { describe, expect, it, vi } from 'vitest';
import { APP_SETTINGS_DEFAULTS, writeAppSettingsDefaults } from '../useAppSettings';
import { SETTING_KEYS } from '@/constants';

describe('useAppSettings helpers', () => {
  it('exposes shared defaults for settings pages and composables', () => {
    expect(APP_SETTINGS_DEFAULTS).toEqual({
      enterToSend: true,
      showWordCount: false,
      enableMarkdown: true,
      showMessageIndex: false,
      chatHistoryLimit: 20,
      promptMergeMode: 'adjacent',
      compressionThresholdPercent: 75,
      compressionMode: 'manual',
      mergePromptPresets: true,
      debugMode: false,
    });
  });

  it('writes default settings through the provided storage writer', async () => {
    const write = vi.fn(async () => undefined);

    await writeAppSettingsDefaults(write as never);

    expect(write.mock.calls).toEqual([
      [SETTING_KEYS.ENTER_TO_SEND, true],
      [SETTING_KEYS.SHOW_WORD_COUNT, false],
      [SETTING_KEYS.ENABLE_MARKDOWN, true],
      [SETTING_KEYS.SHOW_MESSAGE_INDEX, false],
      [SETTING_KEYS.CHAT_HISTORY_LIMIT, 20],
      [SETTING_KEYS.MERGE_PROMPT_PRESETS, true],
      [SETTING_KEYS.PROMPT_MERGE_MODE, 'adjacent'],
      [SETTING_KEYS.COMPRESSION_THRESHOLD_PERCENT, 75],
      [SETTING_KEYS.COMPRESSION_MODE, 'manual'],
      [SETTING_KEYS.DEBUG_MODE, false],
    ]);
  });
});
