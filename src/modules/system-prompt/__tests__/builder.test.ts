import { describe, expect, it } from 'vitest';
import { buildSystemPrompt } from '../core/builder';
import { fillItemContent, isChatHistoryItem, isUserInstructionItem } from '../core/content-filler';
import { estimateMessagesTokens, estimateTokens, isContentEmpty, isValidRoleType, normalizeContent } from '../utils';
import type { AICharacter, KnowledgeBase, PromptItem, PromptPreset, UserCharacter } from '@/types';

const now = 1_700_000_000_000;

const aiCharacter: AICharacter = {
  id: 'ai-1',
  name: '助手',
  description: '负责回答问题',
  personality: '友好、简洁',
  createdAt: now,
};

const userCharacter: UserCharacter = {
  id: 'user-1',
  name: '用户',
  description: '测试用户',
  createdAt: now,
};

const knowledgeBases: KnowledgeBase[] = [
  {
    id: 'kb-1',
    name: '知识库',
    description: '默认知识库',
    globallyEnabled: true,
    createdAt: now,
    updatedAt: now,
    entries: [
      {
        id: 'entry-1',
        name: '条目一',
        content: '第一条知识',
        enabled: true,
        priority: 1,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'entry-2',
        name: '条目二',
        content: '第二条知识',
        enabled: false,
        priority: 2,
        createdAt: now,
        updatedAt: now,
      },
    ],
  },
];

const presetItems: PromptItem[] = [
  { id: 'custom', name: '主提示词', description: '', enabled: true, prompt: '  你是一个助手。\r\n请简洁回答。  ', roleType: 'system', insertPosition: 3 },
  { id: 'character', name: '角色设定', description: '', enabled: true, prompt: '', roleType: 'system', insertPosition: 1 },
  { id: 'history', name: '聊天历史', description: '', enabled: true, prompt: '', roleType: 'system', insertPosition: 4 },
  { id: 'instruction', name: '用户指令', description: '', enabled: true, prompt: '', roleType: 'user', insertPosition: 5 },
  { id: 'disabled', name: '禁用条目', description: '', enabled: false, prompt: 'ignore me', roleType: 'system', insertPosition: 2 },
];

const preset: PromptPreset = {
  id: 'preset-1',
  name: '默认预设',
  items: presetItems,
  createdAt: now,
  updatedAt: now,
};

describe('system-prompt builder', () => {
  it('fills placeholders and reports placeholder metadata', () => {
    const result = fillItemContent(
      { id: 'knowledge', name: '知识库', description: '', enabled: true, prompt: '', roleType: 'system' },
      { aiCharacter, userCharacter, knowledgeBases, userInstruction: '回答中文', chatHistory: [] },
    );

    expect(result.placeholder).toBe('knowledge');
    expect(result.content).toContain('第一条知识');
    expect(result.content).not.toContain('第二条知识');
  });

  it('recognizes special chat-history and user-instruction items', () => {
    expect(isChatHistoryItem({ id: 'h', name: '聊天历史', description: '', enabled: true, prompt: '', roleType: 'system' })).toBe(true);
    expect(isUserInstructionItem({ id: 'u', name: '用户指令', description: '', enabled: true, prompt: '', roleType: 'user' })).toBe(true);
  });

  it('builds merged messages, tracks used items, and skips disabled items', () => {
    const result = buildSystemPrompt({
      preset,
      aiCharacter,
      userCharacter,
      knowledgeBases,
      chatHistory: [
        { id: 'm1', type: 'user', content: '你好', timestamp: now },
        { id: 'm2', type: 'assistant', content: '你好，我在', timestamp: now },
      ],
      userInstruction: '请用中文回答',
      mergeMode: 'adjacent',
    });

    expect(result.usedItemIds).toEqual(['character', 'custom', 'history', 'instruction']);
    expect(result.skippedItemIds).toEqual(['disabled']);
    expect(result.chatHistoryCount).toBe(2);
    expect(result.userInstructionIncluded).toBe(true);
    expect(result.messages).toEqual([
      {
        role: 'system',
        content: '你现在是助手，以下是你的人设：\n\n【描述】\n负责回答问题\n\n【性格】\n友好、简洁\n\n你是一个助手。\n请简洁回答。',
      },
      { role: 'user', content: '你好' },
      { role: 'assistant', content: '你好，我在' },
      { role: 'user', content: '请用中文回答' },
    ]);
    expect(result.metadata.filledPlaceholders.character).toEqual({
      placeholder: 'character',
      success: true,
      contentLength: '你现在是助手，以下是你的人设：\n\n【描述】\n负责回答问题\n\n【性格】\n友好、简洁'.length,
    });
    expect(result.estimatedTokens).toBe(estimateMessagesTokens(result.messages));
  });
});

describe('system-prompt utils', () => {
  it('normalizes content and detects empty strings', () => {
    expect(normalizeContent('  a\r\nb  ')).toBe('a\nb');
    expect(isContentEmpty('   ')).toBe(true);
    expect(isContentEmpty(' x ')).toBe(false);
  });

  it('estimates tokens and validates role types', () => {
    expect(estimateTokens('1234')).toBe(1);
    expect(estimateTokens('12345')).toBe(2);
    expect(isValidRoleType('system')).toBe(true);
    expect(isValidRoleType('tool')).toBe(false);
  });
});
