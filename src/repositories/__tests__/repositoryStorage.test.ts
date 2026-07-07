import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AICharacter, KnowledgeBase, Preset, PromptPreset, RegexRule, UserCharacter } from '@/types';
import { DEFAULT_AI_CHARACTERS, DEFAULT_PROMPT_PRESETS, DEFAULT_REGEX_SCRIPTS, DEFAULT_USER_CHARACTER, STORAGE_KEYS } from '@/constants';

const getStorageMock = vi.fn();
const setStorageMock = vi.fn();
const clearRegexCacheMock = vi.fn();

vi.mock('@/utils/storage', () => ({
  getStorage: getStorageMock,
  setStorage: setStorageMock,
}));

vi.mock('@/utils/regexEngine', () => ({
  clearRegexCache: clearRegexCacheMock,
}));

describe('repository storage adapters', () => {
  beforeEach(() => {
    getStorageMock.mockReset();
    setStorageMock.mockReset();
    clearRegexCacheMock.mockReset();
    vi.resetModules();
  });

  it('loads character defaults and persists selected user id through characterRepository', async () => {
    getStorageMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(null);

    const repository = await import('../characterRepository');

    const userCharacters = await repository.loadUserCharacters();
    const aiCharacters = await repository.loadAICharacters();

    expect(userCharacters).toHaveLength(1);
    expect(userCharacters[0]).toMatchObject({
      id: DEFAULT_USER_CHARACTER.id,
      name: DEFAULT_USER_CHARACTER.name,
      description: DEFAULT_USER_CHARACTER.description,
    });
    expect(aiCharacters).toHaveLength(DEFAULT_AI_CHARACTERS.length);
    expect(aiCharacters[0]).toMatchObject({
      id: DEFAULT_AI_CHARACTERS[0]!.id,
      name: DEFAULT_AI_CHARACTERS[0]!.name,
      description: DEFAULT_AI_CHARACTERS[0]!.description,
      personality: DEFAULT_AI_CHARACTERS[0]!.personality,
    });
    await expect(repository.loadSelectedUserCharacterId()).resolves.toBeNull();

    await repository.saveSelectedUserCharacterId('user-1');
    expect(setStorageMock).toHaveBeenCalledWith(STORAGE_KEYS.SELECTED_USER_CHARACTER, 'user-1');
  });

  it('clears knowledge-base references from AI characters only when needed', async () => {
    const characters: AICharacter[] = [
      { id: 'ai-1', name: 'A', description: '', personality: '', knowledgeBaseId: 'kb-1', createdAt: 1 },
      { id: 'ai-2', name: 'B', description: '', personality: '', knowledgeBaseId: 'kb-2', createdAt: 1 },
    ];
    getStorageMock.mockResolvedValue(characters);

    const repository = await import('../characterRepository');
    const changed = await repository.clearKnowledgeBaseReferenceFromAICharacters('kb-1');

    expect(changed).toBe(true);
    expect(setStorageMock).toHaveBeenCalledWith(STORAGE_KEYS.AI_CHARACTERS, [
      { ...characters[0], knowledgeBaseId: undefined },
      characters[1],
    ]);
  });

  it('loads regex defaults and clears regex cache before reading', async () => {
    getStorageMock.mockResolvedValue('invalid');

    const repository = await import('../regexRuleRepository');
    const rules = await repository.loadRegexRules();

    expect(clearRegexCacheMock).toHaveBeenCalledTimes(1);
    expect(rules).toEqual([...DEFAULT_REGEX_SCRIPTS]);
  });

  it('loads and saves knowledge bases through knowledgeBaseRepository', async () => {
    const knowledgeBases: KnowledgeBase[] = [
      { id: 'kb-1', name: 'KB', description: '', entries: [], globallyEnabled: true, createdAt: 1, updatedAt: 1 },
    ];
    getStorageMock.mockResolvedValue(knowledgeBases);

    const repository = await import('../knowledgeBaseRepository');

    await expect(repository.loadKnowledgeBases()).resolves.toEqual(knowledgeBases);
    await repository.saveKnowledgeBases(knowledgeBases);
    expect(setStorageMock).toHaveBeenCalledWith(STORAGE_KEYS.KNOWLEDGE_BASES, knowledgeBases);
  });

  it('loads prompt presets with cloned defaults and selected id', async () => {
    getStorageMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce('default');

    const repository = await import('../promptPresetRepository');
    const presets = await repository.loadPromptPresets();
    const selectedId = await repository.loadSelectedPromptPresetId();

    expect(presets).toHaveLength(DEFAULT_PROMPT_PRESETS.length);
    expect(presets[0]).toMatchObject({
      id: DEFAULT_PROMPT_PRESETS[0]!.id,
      name: DEFAULT_PROMPT_PRESETS[0]!.name,
      items: [...DEFAULT_PROMPT_PRESETS[0]!.items],
    });
    expect(selectedId).toBe('default');
  });

  it('selects and falls back to current API preset through apiPresetRepository', async () => {
    const presets: Preset[] = [
      {
        id: 'preset-1',
        name: 'Preset 1',
        url: 'https://example.com',
        apiKey: 'key',
        model: 'model',
        streamEnabled: true,
        temperature: 0.7,
        maxTokens: 2048,
        maxOutputTokens: 4096,
        createdAt: 1,
        updatedAt: 1,
      },
    ];
    getStorageMock
      .mockResolvedValueOnce(presets)
      .mockResolvedValueOnce('missing');

    const repository = await import('../apiPresetRepository');
    const current = await repository.loadCurrentApiPreset();

    expect(current).toEqual(presets[0]);
    expect(setStorageMock).toHaveBeenCalledWith(STORAGE_KEYS.SELECTED_PRESET, 'preset-1');
  });

  it('saves repository collections using their storage keys', async () => {
    const userCharacters: UserCharacter[] = [{ id: 'user-1', name: 'User', description: '', createdAt: 1 }];
    const aiCharacters: AICharacter[] = [{ id: 'ai-1', name: 'AI', description: '', personality: '', createdAt: 1 }];
    const regexRules: RegexRule[] = [];
    const promptPresets: PromptPreset[] = [];
    const apiPresets: Preset[] = [];

    const characterRepository = await import('../characterRepository');
    const regexRepository = await import('../regexRuleRepository');
    const promptRepository = await import('../promptPresetRepository');
    const apiRepository = await import('../apiPresetRepository');

    await characterRepository.saveUserCharacters(userCharacters);
    await characterRepository.saveAICharacters(aiCharacters);
    await regexRepository.saveRegexRules(regexRules);
    await promptRepository.savePromptPresets(promptPresets);
    await apiRepository.saveApiPresets(apiPresets);

    expect(setStorageMock).toHaveBeenCalledWith(STORAGE_KEYS.USER_CHARACTERS, userCharacters);
    expect(setStorageMock).toHaveBeenCalledWith(STORAGE_KEYS.AI_CHARACTERS, aiCharacters);
    expect(setStorageMock).toHaveBeenCalledWith(STORAGE_KEYS.REGEX_SCRIPTS, regexRules);
    expect(setStorageMock).toHaveBeenCalledWith(STORAGE_KEYS.PROMPT_PRESETS, promptPresets);
    expect(setStorageMock).toHaveBeenCalledWith(STORAGE_KEYS.API_PRESETS, apiPresets);
  });
});
