import { describe, expect, it } from 'vitest';
import {
  CharacterCardParseError,
  fromCharacterCardData,
  parseCharacterImport,
  serializeCharacterBackup,
  serializeCharacterCard,
  toCharacterCardData,
  toSafeFileName,
} from '../cardCodec';
import type { AICharacter } from '@/types';

const character: AICharacter = {
  id: 'ai-1',
  name: '小助手',
  description: '负责回答问题',
  personality: '友好、简洁',
  knowledgeBaseId: 'kb-1',
  creator: '某人',
  characterVersion: '1.2',
  creatorNotes: '仅用于测试',
  tags: ['科幻', '助手'],
  scenario: '在一艘飞船上',
  firstMessage: '你好，我是{{char}}',
  alternateGreetings: ['第二条开场白'],
  exampleDialogue: '{{user}}: 你好\n{{char}}: 你好',
  createdAt: 1_700_000_000_000,
};

describe('character card codec', () => {
  it('exports a SillyTavern v2 card with snake_case fields', () => {
    const card = JSON.parse(serializeCharacterCard(character));

    expect(card.spec).toBe('chara_card_v2');
    expect(card.data.name).toBe('小助手');
    expect(card.data.first_mes).toBe('你好，我是{{char}}');
    expect(card.data.mes_example).toBe(character.exampleDialogue);
    expect(card.data.creator).toBe('某人');
    expect(card.data.character_version).toBe('1.2');
    expect(card.data.alternate_greetings).toEqual(['第二条开场白']);
    expect(card.data.tags).toEqual(['科幻', '助手']);
  });

  it('does not leak app-specific fields into the portable card', () => {
    const card = JSON.parse(serializeCharacterCard(character));

    expect(card.data).not.toHaveProperty('knowledgeBaseId');
    expect(card.data).not.toHaveProperty('id');
  });

  it('round-trips through the ST v2 export', () => {
    const imported = parseCharacterImport(serializeCharacterCard(character));

    expect(imported).toHaveLength(1);
    expect(imported[0]).toEqual({
      ...toCharacterCardData(character),
      knowledgeBaseId: undefined,
    });
    expect(fromCharacterCardData(imported[0]!)).toEqual({
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
    });
  });

  it('imports a SillyTavern v1 flat card', () => {
    const imported = parseCharacterImport(JSON.stringify({
      name: '旧卡',
      description: 'v1 角色',
      personality: '安静',
      first_mes: '你好',
      mes_example: '示例',
      creator_notes: '注释',
      creator: '作者',
      character_version: '0.9',
      tags: '标签一, 标签二',
    }));

    expect(imported).toHaveLength(1);
    expect(imported[0]).toMatchObject({
      name: '旧卡',
      personality: '安静',
      firstMessage: '你好',
      exampleDialogue: '示例',
      creator: '作者',
      characterVersion: '0.9',
      // v1 的 tags 常写成逗号分隔字符串
      tags: ['标签一', '标签二'],
    });
  });

  it('imports a backup and keeps knowledge base bindings', () => {
    const imported = parseCharacterImport(serializeCharacterBackup([character]));

    expect(imported).toHaveLength(1);
    expect(imported[0]).toMatchObject({
      name: '小助手',
      firstMessage: '你好，我是{{char}}',
      knowledgeBaseId: 'kb-1',
    });
    // camelCase 备份也能解析
    expect(imported[0]!.scenario).toBe('在一艘飞船上');
    expect(imported[0]!.exampleDialogue).toBe(character.exampleDialogue);
  });

  it('imports a bare array of internal characters', () => {
    const imported = parseCharacterImport(JSON.stringify([character]));

    expect(imported).toHaveLength(1);
    expect(imported[0]!.name).toBe('小助手');
    expect(imported[0]!.knowledgeBaseId).toBe('kb-1');
  });

  it('skips entries without a name but keeps the valid ones', () => {
    const imported = parseCharacterImport(JSON.stringify({
      characters: [{ description: '没有名字' }, { ...character }],
    }));

    expect(imported).toHaveLength(1);
    expect(imported[0]!.name).toBe('小助手');
  });

  it('rejects invalid JSON and unrecognized shapes', () => {
    expect(() => parseCharacterImport('不是 json')).toThrow(CharacterCardParseError);
    expect(() => parseCharacterImport('{"foo":"bar"}')).toThrow(CharacterCardParseError);
    expect(() => parseCharacterImport('[]')).toThrow(CharacterCardParseError);
  });

  it('builds safe file names', () => {
    expect(toSafeFileName('小助手')).toBe('小助手.json');
    expect(toSafeFileName('a/b:c*d?')).toBe('a_b_c_d_.json');
    expect(toSafeFileName('   ')).toBe('character.json');
  });
});
