import { STORAGE_KEYS, DEFAULT_PROMPT_PRESETS } from '@/constants';
import type { Conversation, PromptItem, PromptPreset } from '@/types';
import { getStorage, setStorage } from '@/utils/storage';

export const STORAGE_SCHEMA_VERSION = 1;

function normalizePromptItem(item: Partial<PromptItem>, index: number): PromptItem {
  return {
    id: item.id ?? `migrated-item-${index + 1}`,
    name: item.name ?? `条目 ${index + 1}`,
    description: item.description ?? '',
    enabled: item.enabled ?? true,
    prompt: item.prompt ?? '',
    roleType: item.roleType ?? 'system',
    insertPosition: item.insertPosition ?? index + 1,
  };
}

function normalizePromptPreset(preset: Partial<PromptPreset>, index: number): PromptPreset {
  const fallback = DEFAULT_PROMPT_PRESETS[0];
  const items = Array.isArray(preset.items) && preset.items.length > 0
    ? preset.items.map((item, itemIndex) => normalizePromptItem(item, itemIndex))
    : fallback.items.map((item, itemIndex) => normalizePromptItem(item, itemIndex));

  const now = Date.now();

  return {
    id: preset.id ?? `migrated-preset-${index + 1}`,
    name: preset.name ?? `预设 ${index + 1}`,
    items,
    createdAt: preset.createdAt ?? now,
    updatedAt: preset.updatedAt ?? preset.createdAt ?? now,
  };
}

function normalizeConversation(conversation: Partial<Conversation>, index: number): Conversation {
  const now = Date.now();
  const messages = Array.isArray(conversation.messages) ? conversation.messages : [];

  return {
    id: conversation.id ?? `migrated-conv-${index + 1}`,
    title: conversation.title ?? '未命名会话',
    characterId: conversation.characterId,
    characterName: conversation.characterName,
    messages,
    createdAt: conversation.createdAt ?? now,
    updatedAt: conversation.updatedAt ?? conversation.createdAt ?? now,
  };
}

async function migrateToV1(): Promise<void> {
  const promptPresets = await getStorage<PromptPreset[]>(
    STORAGE_KEYS.PROMPT_PRESETS,
    [...DEFAULT_PROMPT_PRESETS].map(preset => ({ ...preset, items: [...preset.items] }))
  );

  const normalizedPromptPresets = (Array.isArray(promptPresets) ? promptPresets : [])
    .map((preset, index) => normalizePromptPreset(preset, index));

  await setStorage(
    STORAGE_KEYS.PROMPT_PRESETS,
    normalizedPromptPresets.length > 0
      ? normalizedPromptPresets
      : [...DEFAULT_PROMPT_PRESETS].map(preset => ({ ...preset, items: [...preset.items] }))
  );

  const selectedPromptPresetId = await getStorage<string | null>(STORAGE_KEYS.SELECTED_PROMPT_PRESET, null);
  const selectedPromptPresetExists = normalizedPromptPresets.some(preset => preset.id === selectedPromptPresetId);
  if (!selectedPromptPresetExists) {
    await setStorage(
      STORAGE_KEYS.SELECTED_PROMPT_PRESET,
      normalizedPromptPresets[0]?.id ?? DEFAULT_PROMPT_PRESETS[0]!.id
    );
  }

  const conversations = await getStorage<Conversation[]>(STORAGE_KEYS.CONVERSATIONS, []);
  const normalizedConversations = (Array.isArray(conversations) ? conversations : [])
    .map((conversation, index) => normalizeConversation(conversation, index));
  await setStorage(STORAGE_KEYS.CONVERSATIONS, normalizedConversations);
}

export async function ensureStorageSchema(): Promise<number> {
  const currentVersion = await getStorage<number>(STORAGE_KEYS.STORAGE_SCHEMA_VERSION, 0);

  if (currentVersion >= STORAGE_SCHEMA_VERSION) {
    return currentVersion;
  }

  if (currentVersion < 1) {
    await migrateToV1();
  }

  await setStorage(STORAGE_KEYS.STORAGE_SCHEMA_VERSION, STORAGE_SCHEMA_VERSION);
  return STORAGE_SCHEMA_VERSION;
}
