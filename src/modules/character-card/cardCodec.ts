/**
 * 角色卡编解码
 *
 * 目标是「能互相导入」：外部字段名完全对齐 SillyTavern v2 角色卡，
 * 内部类型保持 camelCase。两边映射只在这一个文件里，方便对照。
 *
 * 支持三种输入：
 * 1. SillyTavern v2 单卡：{ spec: 'chara_card_v2', data: {...} }
 * 2. SillyTavern v1 扁平卡：{ name, description, first_mes, ... }
 * 3. 本应用备份：{ spec: 'conexion.characters/v1', characters: [...] }
 *
 * 两种输出：
 * - serializeCharacterCard：单张 ST v2 卡，给别的应用用
 * - serializeCharacterBackup：全量备份，保留知识库绑定等应用内字段
 */

import type { AICharacter } from '@/types';

export const BACKUP_SPEC = 'conexion.characters/v1';
export const ST_CARD_SPEC = 'chara_card_v2';
export const ST_CARD_SPEC_VERSION = '2.0';

/** 与外部互通的可移植字段集合 */
export interface CharacterCardData {
  name: string;
  description: string;
  personality: string;
  scenario?: string;
  firstMessage?: string;
  alternateGreetings?: string[];
  exampleDialogue?: string;
  creator?: string;
  characterVersion?: string;
  creatorNotes?: string;
  tags?: string[];
}

/** 导入结果：可移植字段 + 备份文件里才有的应用内字段 */
export interface ImportedCharacter extends CharacterCardData {
  knowledgeBaseId?: string;
}

export class CharacterCardParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CharacterCardParseError';
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(source: Record<string, unknown>, key: string): string | undefined {
  const value = source[key];
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? value : undefined;
}

/**
 * 读取字符串数组。兼容 ST v1 里 tags 写成逗号分隔字符串的情况。
 */
function readStringArray(source: Record<string, unknown>, key: string): string[] | undefined {
  const value = source[key];

  if (typeof value === 'string') {
    const items = value.split(',').map(item => item.trim()).filter(Boolean);
    return items.length > 0 ? items : undefined;
  }

  if (!Array.isArray(value)) return undefined;

  const items = value
    .filter((item): item is string => typeof item === 'string')
    .map(item => item.trim())
    .filter(Boolean);

  return items.length > 0 ? items : undefined;
}

/**
 * 内部角色 → 可移植字段
 */
export function toCharacterCardData(character: AICharacter): CharacterCardData {
  return {
    name: character.name,
    description: character.description,
    personality: character.personality,
    scenario: character.scenario,
    firstMessage: character.firstMessage,
    alternateGreetings: character.alternateGreetings,
    exampleDialogue: character.exampleDialogue,
    creator: character.creator,
    characterVersion: character.characterVersion,
    creatorNotes: character.creatorNotes,
    tags: character.tags,
  };
}

/**
 * 可移植字段 → 内部角色（不含 id / createdAt，由调用方补）
 */
export function fromCharacterCardData(data: CharacterCardData): Omit<AICharacter, 'id' | 'createdAt'> {
  return {
    name: data.name,
    description: data.description,
    personality: data.personality,
    scenario: data.scenario,
    firstMessage: data.firstMessage,
    alternateGreetings: data.alternateGreetings,
    exampleDialogue: data.exampleDialogue,
    creator: data.creator,
    characterVersion: data.characterVersion,
    creatorNotes: data.creatorNotes,
    tags: data.tags,
  };
}

/**
 * 解析 ST v2 卡片的 data 段（或 v1 扁平对象）
 */
function parseCardData(source: Record<string, unknown>): ImportedCharacter | null {
  const name = readString(source, 'name');
  if (!name) return null;

  return {
    name,
    description: readString(source, 'description') ?? '',
    personality: readString(source, 'personality') ?? '',
    scenario: readString(source, 'scenario'),
    firstMessage: readString(source, 'first_mes'),
    alternateGreetings: readStringArray(source, 'alternate_greetings'),
    exampleDialogue: readString(source, 'mes_example'),
    creator: readString(source, 'creator'),
    characterVersion: readString(source, 'character_version'),
    creatorNotes: readString(source, 'creator_notes'),
    tags: readStringArray(source, 'tags'),
  };
}

/**
 * 解析备份文件里的角色（内部字段名，保留 knowledgeBaseId）
 */
function parseBackupCharacter(source: Record<string, unknown>): ImportedCharacter | null {
  const name = readString(source, 'name');
  if (!name) return null;

  return {
    name,
    description: readString(source, 'description') ?? '',
    personality: readString(source, 'personality') ?? '',
    scenario: readString(source, 'scenario'),
    firstMessage: readString(source, 'firstMessage') ?? readString(source, 'first_mes'),
    alternateGreetings: readStringArray(source, 'alternateGreetings') ?? readStringArray(source, 'alternate_greetings'),
    exampleDialogue: readString(source, 'exampleDialogue') ?? readString(source, 'mes_example'),
    creator: readString(source, 'creator'),
    characterVersion: readString(source, 'characterVersion') ?? readString(source, 'character_version'),
    creatorNotes: readString(source, 'creatorNotes') ?? readString(source, 'creator_notes'),
    tags: readStringArray(source, 'tags'),
    knowledgeBaseId: readString(source, 'knowledgeBaseId'),
  };
}

/**
 * 解析导入文件，返回待新增的角色列表。
 *
 * 容错策略：整体结构不对就抛错；单个角色缺 name 就跳过。
 */
export function parseCharacterImport(text: string): ImportedCharacter[] {
  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    throw new CharacterCardParseError('不是合法的 JSON 文件');
  }

  const characters = collectCharacters(parsed);
  if (characters.length === 0) {
    throw new CharacterCardParseError('文件里没有找到可导入的角色');
  }

  return characters;
}

function collectCharacters(parsed: unknown): ImportedCharacter[] {
  // 裸数组：本应用备份的角色数组，或一组 ST v1 卡
  if (Array.isArray(parsed)) {
    return parsed
      .filter(isObject)
      .map(parseBackupCharacter)
      .filter((character): character is ImportedCharacter => character !== null);
  }

  if (!isObject(parsed)) {
    throw new CharacterCardParseError('文件内容不是角色卡或角色数组');
  }

  // 本应用备份
  if (Array.isArray(parsed.characters)) {
    return parsed.characters
      .filter(isObject)
      .map(parseBackupCharacter)
      .filter((character): character is ImportedCharacter => character !== null);
  }

  // ST v2 单卡
  if (isObject(parsed.data)) {
    const card = parseCardData(parsed.data);
    return card ? [card] : [];
  }

  // ST v1 扁平卡
  const flatCard = parseCardData(parsed);
  return flatCard ? [flatCard] : [];
}

/**
 * 导出为 SillyTavern v2 单卡
 */
export function serializeCharacterCard(character: AICharacter): string {
  const data = toCharacterCardData(character);

  return JSON.stringify(
    {
      spec: ST_CARD_SPEC,
      spec_version: ST_CARD_SPEC_VERSION,
      data: {
        name: data.name,
        description: data.description,
        personality: data.personality,
        scenario: data.scenario ?? '',
        first_mes: data.firstMessage ?? '',
        mes_example: data.exampleDialogue ?? '',
        creator_notes: data.creatorNotes ?? '',
        system_prompt: '',
        post_history_instructions: '',
        alternate_greetings: data.alternateGreetings ?? [],
        character_book: null,
        tags: data.tags ?? [],
        creator: data.creator ?? '',
        character_version: data.characterVersion ?? '',
        extensions: {},
      },
    },
    null,
    2
  );
}

/**
 * 导出全量备份（保留知识库绑定等应用内字段）
 */
export function serializeCharacterBackup(characters: AICharacter[]): string {
  return JSON.stringify(
    {
      spec: BACKUP_SPEC,
      exportedAt: new Date().toISOString(),
      characters,
    },
    null,
    2
  );
}

/**
 * 生成导入文件的安全文件名
 */
export function toSafeFileName(name: string, extension = 'json'): string {
  const base = name
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();

  return `${base || 'character'}.${extension}`;
}
