import {
  DEFAULT_AI_CHARACTERS,
  DEFAULT_API_PRESETS,
  DEFAULT_KNOWLEDGE_BASES,
  DEFAULT_PROMPT_PRESETS,
  DEFAULT_REGEX_SCRIPTS,
  DEFAULT_USER_CHARACTER,
  STORAGE_KEYS,
} from '@/constants';
import type {
  AICharacter,
  Conversation,
  KnowledgeBase,
  Preset,
  PromptItem,
  PromptPreset,
  RegexRule,
  UserCharacter,
} from '@/types';
import { APP_SETTINGS_DEFAULTS } from '@/composables/useAppSettings';
import { getStorage, setStorage } from '@/utils/storage';
import { clampCompressionThresholdPercent } from './conversationCompression';

export const STORAGE_SCHEMA_VERSION = 3;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeTimestamp(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function normalizeString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function clonePromptPresets(): PromptPreset[] {
  return [...DEFAULT_PROMPT_PRESETS].map(preset => ({
    ...preset,
    items: [...preset.items].map(item => ({ ...item })),
  }));
}

function cloneApiPresets(): Preset[] {
  return [...DEFAULT_API_PRESETS].map(preset => ({ ...preset }));
}

function cloneRegexRules(): RegexRule[] {
  return [...DEFAULT_REGEX_SCRIPTS].map(rule => ({ ...rule }));
}

function cloneAICharacters(): AICharacter[] {
  return [...DEFAULT_AI_CHARACTERS].map(character => ({ ...character }));
}

function cloneUserCharacters(): UserCharacter[] {
  return [{ ...DEFAULT_USER_CHARACTER }];
}

function cloneKnowledgeBases(): KnowledgeBase[] {
  return (DEFAULT_KNOWLEDGE_BASES as unknown as KnowledgeBase[]).map(kb => ({
    ...kb,
    entries: [...kb.entries].map(entry => ({ ...entry })),
  }));
}

function normalizePromptItem(item: Partial<PromptItem>, index: number): PromptItem {
  return {
    id: normalizeString(item.id, `migrated-item-${index + 1}`),
    name: normalizeString(item.name, `条目 ${index + 1}`),
    description: normalizeString(item.description),
    enabled: normalizeBoolean(item.enabled, true),
    prompt: normalizeString(item.prompt),
    roleType: item.roleType === 'system' || item.roleType === 'user' || item.roleType === 'assistant'
      ? item.roleType
      : 'system',
    insertPosition: typeof item.insertPosition === 'number' ? item.insertPosition : index + 1,
  };
}

function normalizePromptPreset(preset: Partial<PromptPreset>, index: number): PromptPreset {
  const fallback = DEFAULT_PROMPT_PRESETS[0]!;
  const items = Array.isArray(preset.items) && preset.items.length > 0
    ? preset.items.map((item, itemIndex) => normalizePromptItem(item, itemIndex))
    : fallback.items.map((item, itemIndex) => normalizePromptItem(item, itemIndex));

  const now = Date.now();
  const createdAt = normalizeTimestamp(preset.createdAt, now);

  return {
    id: normalizeString(preset.id, `migrated-preset-${index + 1}`),
    name: normalizeString(preset.name, `预设 ${index + 1}`),
    items,
    createdAt,
    updatedAt: normalizeTimestamp(preset.updatedAt, createdAt),
  };
}

function normalizeConversation(conversation: Partial<Conversation>, index: number): Conversation {
  const now = Date.now();
  const messages = Array.isArray(conversation.messages) ? conversation.messages : [];
  const createdAt = normalizeTimestamp(conversation.createdAt, now);
  const rawCompression = isObject(conversation.compression) ? conversation.compression : null;
  const sourceMessageIds = Array.isArray(rawCompression?.sourceMessageIds)
    ? rawCompression.sourceMessageIds.filter((id): id is string => typeof id === 'string')
    : [];
  const summaryContent = normalizeString(rawCompression?.summaryContent);
  const promptContent = normalizeString(rawCompression?.promptContent);

  return {
    id: normalizeString(conversation.id, `migrated-conv-${index + 1}`),
    title: normalizeString(conversation.title, '未命名会话'),
    characterId: typeof conversation.characterId === 'string' ? conversation.characterId : undefined,
    characterName: typeof conversation.characterName === 'string' ? conversation.characterName : undefined,
    messages,
    compressed: normalizeBoolean(conversation.compressed, summaryContent.length > 0),
    compression: summaryContent
      ? {
          compressedAt: normalizeTimestamp(rawCompression?.compressedAt, createdAt),
          summaryContent,
          promptContent: promptContent || summaryContent,
          sourceMessageCount: typeof rawCompression?.sourceMessageCount === 'number'
            ? rawCompression.sourceMessageCount
            : sourceMessageIds.length,
          sourceMessageIds,
          keepRecentCount: typeof rawCompression?.keepRecentCount === 'number'
            ? rawCompression.keepRecentCount
            : 6,
          contextBeforeCompression: typeof rawCompression?.contextBeforeCompression === 'number'
            ? rawCompression.contextBeforeCompression
            : undefined,
          contextAfterCompression: typeof rawCompression?.contextAfterCompression === 'number'
            ? rawCompression.contextAfterCompression
            : undefined,
        }
      : undefined,
    createdAt,
    updatedAt: normalizeTimestamp(conversation.updatedAt, createdAt),
  };
}

function normalizeApiPreset(preset: Partial<Preset>, index: number): Preset {
  const fallback = DEFAULT_API_PRESETS[0]!;
  const now = Date.now();
  const createdAt = normalizeTimestamp(preset.createdAt, now);

  return {
    id: normalizeString(preset.id, `migrated-api-preset-${index + 1}`),
    name: normalizeString(preset.name, `API 预设 ${index + 1}`),
    url: normalizeString(preset.url),
    apiKey: normalizeString(preset.apiKey),
    model: normalizeString(preset.model),
    streamEnabled: normalizeBoolean(preset.streamEnabled, fallback.streamEnabled),
    temperature: typeof preset.temperature === 'number' ? preset.temperature : fallback.temperature,
    maxTokens: typeof preset.maxTokens === 'number' ? preset.maxTokens : fallback.maxTokens,
    maxOutputTokens: typeof preset.maxOutputTokens === 'number' ? preset.maxOutputTokens : fallback.maxOutputTokens,
    contextLength: typeof preset.contextLength === 'number' ? preset.contextLength : undefined,
    createdAt,
    updatedAt: normalizeTimestamp(preset.updatedAt, createdAt),
  };
}

function normalizeUserCharacter(character: Partial<UserCharacter>, index: number): UserCharacter {
  const now = Date.now();
  return {
    id: normalizeString(character.id, `migrated-user-${index + 1}`),
    name: normalizeString(character.name, `用户 ${index + 1}`),
    description: normalizeString(character.description),
    createdAt: normalizeTimestamp(character.createdAt, now),
  };
}

function normalizeAICharacter(character: Partial<AICharacter>, index: number, validKnowledgeBaseIds: Set<string>): AICharacter {
  const now = Date.now();
  const knowledgeBaseId = typeof character.knowledgeBaseId === 'string' && validKnowledgeBaseIds.has(character.knowledgeBaseId)
    ? character.knowledgeBaseId
    : undefined;

  return {
    id: normalizeString(character.id, `migrated-ai-${index + 1}`),
    name: normalizeString(character.name, `角色 ${index + 1}`),
    description: normalizeString(character.description),
    personality: normalizeString(character.personality),
    knowledgeBaseId,
    createdAt: normalizeTimestamp(character.createdAt, now),
  };
}

function normalizeKnowledgeBase(raw: Partial<KnowledgeBase>, index: number): KnowledgeBase {
  const now = Date.now();
  const createdAt = normalizeTimestamp(raw.createdAt, now);
  const entries = Array.isArray(raw.entries) ? raw.entries : [];

  return {
    id: normalizeString(raw.id, `migrated-kb-${index + 1}`),
    name: normalizeString(raw.name, `知识库 ${index + 1}`),
    description: normalizeString(raw.description),
    entries: entries
      .filter(isObject)
      .map((entry, entryIndex) => ({
        id: normalizeString(entry.id, `migrated-entry-${index + 1}-${entryIndex + 1}`),
        name: normalizeString(entry.name, `条目 ${entryIndex + 1}`),
        content: normalizeString(entry.content),
        enabled: normalizeBoolean(entry.enabled, true),
        priority: typeof entry.priority === 'number' ? entry.priority : 50,
        createdAt: normalizeTimestamp(entry.createdAt, now),
        updatedAt: normalizeTimestamp(entry.updatedAt, normalizeTimestamp(entry.createdAt, now)),
      })),
    globallyEnabled: normalizeBoolean(raw.globallyEnabled, false),
    createdAt,
    updatedAt: normalizeTimestamp(raw.updatedAt, createdAt),
  };
}

function normalizeRegexRule(rule: Partial<RegexRule>, index: number): RegexRule {
  const fallback = DEFAULT_REGEX_SCRIPTS[0]!;
  return {
    id: normalizeString(rule.id, `migrated-regex-${index + 1}`),
    name: normalizeString(rule.name, `规则 ${index + 1}`),
    enabled: normalizeBoolean(rule.enabled, true),
    pattern: normalizeString(rule.pattern),
    flags: normalizeString(rule.flags),
    replacement: normalizeString(rule.replacement),
    scope: rule.scope === 'user' || rule.scope === 'assistant' || rule.scope === 'all' ? rule.scope : fallback.scope,
    applyTo: rule.applyTo === 'before-macro' || rule.applyTo === 'after-macro' ? rule.applyTo : fallback.applyTo,
  };
}

async function migrateLocalToIndexedDbIfEmpty<T>(key: string, targetDefault: T): Promise<void> {
  const currentValue = await getStorage<T>(key, targetDefault);
  const targetIsEmptyArray = Array.isArray(currentValue) && currentValue.length === 0;
  const targetIsEmptyString = currentValue === '';
  const targetIsNullish = currentValue === null || currentValue === undefined;

  if (!targetIsEmptyArray && !targetIsEmptyString && !targetIsNullish) {
    return;
  }

  const raw = localStorage.getItem(key);
  if (!raw) {
    return;
  }

  try {
    const parsed = JSON.parse(raw) as T;
    await setStorage(key, parsed);
  } catch {
    // 忽略损坏的旧 localStorage 数据
  }
}

async function migrateToV1(): Promise<void> {
  const promptPresets = await getStorage<PromptPreset[]>(
    STORAGE_KEYS.PROMPT_PRESETS,
    clonePromptPresets()
  );

  const normalizedPromptPresets = (Array.isArray(promptPresets) ? promptPresets : [])
    .map((preset, index) => normalizePromptPreset(preset, index));

  await setStorage(
    STORAGE_KEYS.PROMPT_PRESETS,
    normalizedPromptPresets.length > 0
      ? normalizedPromptPresets
      : clonePromptPresets()
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

async function migrateToV2(): Promise<void> {
  await Promise.all([
    migrateLocalToIndexedDbIfEmpty(STORAGE_KEYS.API_PRESETS, [] as Preset[]),
    migrateLocalToIndexedDbIfEmpty(STORAGE_KEYS.USER_CHARACTERS, [] as UserCharacter[]),
    migrateLocalToIndexedDbIfEmpty(STORAGE_KEYS.AI_CHARACTERS, [] as AICharacter[]),
    migrateLocalToIndexedDbIfEmpty(STORAGE_KEYS.KNOWLEDGE_BASES, [] as KnowledgeBase[]),
    migrateLocalToIndexedDbIfEmpty(STORAGE_KEYS.REGEX_SCRIPTS, [] as RegexRule[]),
    migrateLocalToIndexedDbIfEmpty(STORAGE_KEYS.PROMPT_PRESETS, [] as PromptPreset[]),
  ]);

  const knowledgeBases = await getStorage<KnowledgeBase[]>(STORAGE_KEYS.KNOWLEDGE_BASES, cloneKnowledgeBases());
  const normalizedKnowledgeBases = (Array.isArray(knowledgeBases) ? knowledgeBases : [])
    .filter(isObject)
    .map((kb, index) => normalizeKnowledgeBase(kb, index));
  await setStorage(
    STORAGE_KEYS.KNOWLEDGE_BASES,
    normalizedKnowledgeBases.length > 0 ? normalizedKnowledgeBases : cloneKnowledgeBases()
  );

  const validKnowledgeBaseIds = new Set(normalizedKnowledgeBases.map(kb => kb.id));

  const aiCharacters = await getStorage<AICharacter[]>(STORAGE_KEYS.AI_CHARACTERS, cloneAICharacters());
  const normalizedAICharacters = (Array.isArray(aiCharacters) ? aiCharacters : [])
    .filter(isObject)
    .map((character, index) => normalizeAICharacter(character, index, validKnowledgeBaseIds));
  await setStorage(
    STORAGE_KEYS.AI_CHARACTERS,
    normalizedAICharacters.length > 0 ? normalizedAICharacters : cloneAICharacters()
  );

  const userCharacters = await getStorage<UserCharacter[]>(STORAGE_KEYS.USER_CHARACTERS, cloneUserCharacters());
  const normalizedUserCharacters = (Array.isArray(userCharacters) ? userCharacters : [])
    .filter(isObject)
    .map((character, index) => normalizeUserCharacter(character, index));
  await setStorage(
    STORAGE_KEYS.USER_CHARACTERS,
    normalizedUserCharacters.length > 0 ? normalizedUserCharacters : cloneUserCharacters()
  );

  const apiPresets = await getStorage<Preset[]>(STORAGE_KEYS.API_PRESETS, cloneApiPresets());
  const normalizedApiPresets = (Array.isArray(apiPresets) ? apiPresets : [])
    .filter(isObject)
    .map((preset, index) => normalizeApiPreset(preset, index));
  const finalApiPresets = normalizedApiPresets.length > 0 ? normalizedApiPresets : cloneApiPresets();
  await setStorage(STORAGE_KEYS.API_PRESETS, finalApiPresets);

  const selectedPresetId = await getStorage<string | null>(STORAGE_KEYS.SELECTED_PRESET, null);
  const selectedPresetExists = finalApiPresets.some(preset => preset.id === selectedPresetId);
  if (!selectedPresetExists) {
    await setStorage(STORAGE_KEYS.SELECTED_PRESET, finalApiPresets[0]?.id ?? DEFAULT_API_PRESETS[0]!.id);
  }

  const promptPresets = await getStorage<PromptPreset[]>(STORAGE_KEYS.PROMPT_PRESETS, clonePromptPresets());
  const normalizedPromptPresets = (Array.isArray(promptPresets) ? promptPresets : [])
    .filter(isObject)
    .map((preset, index) => normalizePromptPreset(preset, index));
  const finalPromptPresets = normalizedPromptPresets.length > 0 ? normalizedPromptPresets : clonePromptPresets();
  await setStorage(STORAGE_KEYS.PROMPT_PRESETS, finalPromptPresets);

  const selectedPromptPresetId = await getStorage<string | null>(STORAGE_KEYS.SELECTED_PROMPT_PRESET, null);
  const selectedPromptPresetExists = finalPromptPresets.some(preset => preset.id === selectedPromptPresetId);
  if (!selectedPromptPresetExists) {
    await setStorage(STORAGE_KEYS.SELECTED_PROMPT_PRESET, finalPromptPresets[0]?.id ?? DEFAULT_PROMPT_PRESETS[0]!.id);
  }

  const regexRules = await getStorage<RegexRule[]>(STORAGE_KEYS.REGEX_SCRIPTS, cloneRegexRules());
  const normalizedRegexRules = (Array.isArray(regexRules) ? regexRules : [])
    .filter(isObject)
    .map((rule, index) => normalizeRegexRule(rule, index));
  await setStorage(
    STORAGE_KEYS.REGEX_SCRIPTS,
    normalizedRegexRules.length > 0 ? normalizedRegexRules : cloneRegexRules()
  );

  const conversations = await getStorage<Conversation[]>(STORAGE_KEYS.CONVERSATIONS, []);
  const normalizedConversations = (Array.isArray(conversations) ? conversations : [])
    .filter(isObject)
    .map((conversation, index) => normalizeConversation(conversation, index));
  await setStorage(STORAGE_KEYS.CONVERSATIONS, normalizedConversations);

  const currentPromptMergeMode = await getStorage<string>(
    STORAGE_KEYS.PROMPT_MERGE_MODE,
    APP_SETTINGS_DEFAULTS.promptMergeMode
  );
  if (!['none', 'adjacent', 'all'].includes(currentPromptMergeMode)) {
    await setStorage(STORAGE_KEYS.PROMPT_MERGE_MODE, APP_SETTINGS_DEFAULTS.promptMergeMode);
  }

}

async function migrateToV3(): Promise<void> {
  const conversations = await getStorage<Conversation[]>(STORAGE_KEYS.CONVERSATIONS, []);
  const normalizedConversations = (Array.isArray(conversations) ? conversations : [])
    .filter(isObject)
    .map((conversation, index) => normalizeConversation(conversation, index));
  await setStorage(STORAGE_KEYS.CONVERSATIONS, normalizedConversations);

  const compressionThresholdPercent = await getStorage<number>(
    STORAGE_KEYS.COMPRESSION_THRESHOLD_PERCENT,
    APP_SETTINGS_DEFAULTS.compressionThresholdPercent
  );
  await setStorage(
    STORAGE_KEYS.COMPRESSION_THRESHOLD_PERCENT,
    clampCompressionThresholdPercent(compressionThresholdPercent)
  );

  const compressionMode = await getStorage<string>(
    STORAGE_KEYS.COMPRESSION_MODE,
    APP_SETTINGS_DEFAULTS.compressionMode
  );
  if (!['manual', 'auto'].includes(compressionMode)) {
    await setStorage(STORAGE_KEYS.COMPRESSION_MODE, APP_SETTINGS_DEFAULTS.compressionMode);
  }
}

export async function ensureStorageSchema(): Promise<number> {
  const currentVersion = await getStorage<number>(STORAGE_KEYS.STORAGE_SCHEMA_VERSION, 0);

  if (currentVersion >= STORAGE_SCHEMA_VERSION) {
    return currentVersion;
  }

  if (currentVersion < 1) {
    await migrateToV1();
  }

  if (currentVersion < 2) {
    await migrateToV2();
  }

  if (currentVersion < 3) {
    await migrateToV3();
  }

  await setStorage(STORAGE_KEYS.STORAGE_SCHEMA_VERSION, STORAGE_SCHEMA_VERSION);
  return STORAGE_SCHEMA_VERSION;
}
