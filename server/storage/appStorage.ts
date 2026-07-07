import { join } from 'node:path';
import type { AICharacter, Conversation, KnowledgeBase, Preset, PromptPreset, RegexRule, UserCharacter } from '../../src/types';
import { getServerConfig, type ServerConfig } from '../config';
import { JsonFileStore } from './jsonFileStore';
import type { JsonDataStore } from './types';

export interface AppStorage {
  conversations: JsonDataStore<Conversation[]>;
  userCharacters: JsonDataStore<UserCharacter[]>;
  aiCharacters: JsonDataStore<AICharacter[]>;
  knowledgeBases: JsonDataStore<KnowledgeBase[]>;
  apiPresets: JsonDataStore<Preset[]>;
  promptPresets: JsonDataStore<PromptPreset[]>;
  regexRules: JsonDataStore<RegexRule[]>;
  settings: JsonDataStore<Record<string, unknown>>;
}

export function createAppStorage(config: ServerConfig = getServerConfig()): AppStorage {
  return {
    conversations: new JsonFileStore<Conversation[]>(
      join(config.dataDir, 'conversations.json'),
      () => [],
    ),
    userCharacters: new JsonFileStore<UserCharacter[]>(
      join(config.dataDir, 'user-characters.json'),
      () => [],
    ),
    aiCharacters: new JsonFileStore<AICharacter[]>(
      join(config.dataDir, 'ai-characters.json'),
      () => [],
    ),
    knowledgeBases: new JsonFileStore<KnowledgeBase[]>(
      join(config.dataDir, 'knowledge-bases.json'),
      () => [],
    ),
    apiPresets: new JsonFileStore<Preset[]>(
      join(config.dataDir, 'api-presets.json'),
      () => [],
    ),
    promptPresets: new JsonFileStore<PromptPreset[]>(
      join(config.dataDir, 'prompt-presets.json'),
      () => [],
    ),
    regexRules: new JsonFileStore<RegexRule[]>(
      join(config.dataDir, 'regex-rules.json'),
      () => [],
    ),
    settings: new JsonFileStore<Record<string, unknown>>(
      join(config.dataDir, 'settings.json'),
      () => ({}),
    ),
  };
}
