import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AICharacter, KnowledgeBase, Preset, PromptPreset, RegexRule, UserCharacter } from '@/types';
import { DEFAULT_AI_CHARACTERS, DEFAULT_PROMPT_PRESETS, DEFAULT_REGEX_SCRIPTS, DEFAULT_USER_CHARACTER } from '@/constants';

const clearRegexCacheMock = vi.fn();
const fetchMock = vi.fn<typeof fetch>();

function mockJsonResponse(data: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    status: init.status ?? 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...init.headers },
  });
}

vi.mock('@/utils/regexEngine', () => ({
  clearRegexCache: clearRegexCacheMock,
}));

describe('repository storage adapters', () => {
  beforeEach(() => {
    clearRegexCacheMock.mockReset();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    vi.resetModules();
  });

  it('loads character defaults from backend fallbacks and persists selected user id locally', async () => {
    fetchMock
      .mockResolvedValueOnce(mockJsonResponse([]))
      .mockResolvedValueOnce(mockJsonResponse([]))
      .mockResolvedValueOnce(mockJsonResponse({ value: null }))
      .mockResolvedValueOnce(mockJsonResponse({ value: 'user-1' }));

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
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/characters/users');
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/characters/ai');
    await expect(repository.loadSelectedUserCharacterId()).resolves.toBeNull();

    await repository.saveSelectedUserCharacterId('user-1');
    expect(fetchMock.mock.calls[3]?.[0]).toBe('/api/settings/conexion_selected_user_character');
    expect(fetchMock.mock.calls[3]?.[1]?.method).toBe('PUT');
  });

  it('clears knowledge-base references from AI characters through backend', async () => {
    fetchMock.mockResolvedValue(mockJsonResponse({ changed: true }));

    const repository = await import('../characterRepository');
    const changed = await repository.clearKnowledgeBaseReferenceFromAICharacters('kb-1');

    expect(changed).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith('/api/characters/ai/clear-knowledge-base-reference', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ knowledgeBaseId: 'kb-1' }),
    }));
  });

  it('loads regex defaults and clears regex cache before reading', async () => {
    fetchMock.mockResolvedValue(mockJsonResponse([]));

    const repository = await import('../regexRuleRepository');
    const rules = await repository.loadRegexRules();

    expect(clearRegexCacheMock).toHaveBeenCalledTimes(1);
    expect(rules).toEqual([...DEFAULT_REGEX_SCRIPTS]);
  });

  it('loads and saves knowledge bases through backend API', async () => {
    const knowledgeBases: KnowledgeBase[] = [
      { id: 'kb-1', name: 'KB', description: '', entries: [], globallyEnabled: true, createdAt: 1, updatedAt: 1 },
    ];
    fetchMock
      .mockResolvedValueOnce(mockJsonResponse(knowledgeBases))
      .mockResolvedValueOnce(mockJsonResponse(knowledgeBases));

    const repository = await import('../knowledgeBaseRepository');

    await expect(repository.loadKnowledgeBases()).resolves.toEqual(knowledgeBases);
    await repository.saveKnowledgeBases(knowledgeBases);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/knowledge-bases');
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/knowledge-bases');
    expect(fetchMock.mock.calls[1]?.[1]?.method).toBe('PUT');
    expect(JSON.parse(fetchMock.mock.calls[1]?.[1]?.body as string).knowledgeBases).toEqual(knowledgeBases);
  });

  it('loads prompt presets with cloned defaults from backend fallback and selected id locally', async () => {
    fetchMock
      .mockResolvedValueOnce(mockJsonResponse([]))
      .mockResolvedValueOnce(mockJsonResponse({ value: 'default' }));

    const repository = await import('../promptPresetRepository');
    const presets = await repository.loadPromptPresets();
    const selectedId = await repository.loadSelectedPromptPresetId();

    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/prompt-presets');
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
    fetchMock
      .mockResolvedValueOnce(mockJsonResponse(presets))
      .mockResolvedValueOnce(mockJsonResponse({ value: 'missing' }))
      .mockResolvedValueOnce(mockJsonResponse({ value: 'preset-1' }));

    const repository = await import('../apiPresetRepository');
    const current = await repository.loadCurrentApiPreset();

    expect(current).toEqual(presets[0]);
    expect(fetchMock.mock.calls[2]?.[0]).toBe('/api/settings/conexion_selected_preset');
    expect(fetchMock.mock.calls[2]?.[1]?.method).toBe('PUT');
  });

  it('saves repository collections using backend API for migrated entities and local storage for the rest', async () => {
    const userCharacters: UserCharacter[] = [{ id: 'user-1', name: 'User', description: '', createdAt: 1 }];
    const aiCharacters: AICharacter[] = [{ id: 'ai-1', name: 'AI', description: '', personality: '', createdAt: 1 }];
    const regexRules: RegexRule[] = [];
    const promptPresets: PromptPreset[] = [];
    const apiPresets: Preset[] = [];

    fetchMock
      .mockResolvedValueOnce(mockJsonResponse(userCharacters))
      .mockResolvedValueOnce(mockJsonResponse(aiCharacters))
      .mockResolvedValueOnce(mockJsonResponse(regexRules))
      .mockResolvedValueOnce(mockJsonResponse(promptPresets))
      .mockResolvedValueOnce(mockJsonResponse(apiPresets));

    const characterRepository = await import('../characterRepository');
    const regexRepository = await import('../regexRuleRepository');
    const promptRepository = await import('../promptPresetRepository');
    const apiRepository = await import('../apiPresetRepository');

    await characterRepository.saveUserCharacters(userCharacters);
    await characterRepository.saveAICharacters(aiCharacters);
    await regexRepository.saveRegexRules(regexRules);
    await promptRepository.savePromptPresets(promptPresets);
    await apiRepository.saveApiPresets(apiPresets);

    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/characters/users');
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe('PUT');
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/characters/ai');
    expect(fetchMock.mock.calls[1]?.[1]?.method).toBe('PUT');
    expect(fetchMock.mock.calls[2]?.[0]).toBe('/api/regex-rules');
    expect(fetchMock.mock.calls[2]?.[1]?.method).toBe('PUT');
    expect(fetchMock.mock.calls[3]?.[0]).toBe('/api/prompt-presets');
    expect(fetchMock.mock.calls[3]?.[1]?.method).toBe('PUT');
    expect(fetchMock.mock.calls[4]?.[0]).toBe('/api/api-presets');
    expect(fetchMock.mock.calls[4]?.[1]?.method).toBe('PUT');
  });
});
