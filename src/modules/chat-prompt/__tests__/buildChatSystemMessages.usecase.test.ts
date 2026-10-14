import { describe, expect, it } from 'vitest';
import { DEFAULT_PROMPT_PRESETS } from '@/constants';
import type { KnowledgeBase, PromptPreset } from '@/types';
import { buildSystemMessagesUseCase } from '../application/buildChatSystemMessages.usecase';

const knowledgePreset: PromptPreset = {
  id: 'knowledge-preset', name: '知识测试', createdAt: 1, updatedAt: 1,
  items: [{ id: 'knowledge-base', name: '知识库', description: '', enabled: true, prompt: '', roleType: 'system' }],
};

function knowledgeBase(id: string, globallyEnabled: boolean, priorities: number[]): KnowledgeBase {
  return {
    id, name: id, description: '', globallyEnabled, createdAt: 1, updatedAt: 1,
    entries: priorities.map((priority, index) => ({
      id: `${id}-${index}`, name: `${id}-${index}`, content: `正文-${id}-${index} {{char}}`,
      priority, enabled: true, createdAt: 1, updatedAt: 1,
    })),
  };
}

describe('knowledge selection in preset and fallback paths', () => {
  it.each([knowledgePreset, null])('includes global and bound knowledge once, sorted across bases (preset: %s)', preset => {
    const global = knowledgeBase('global', true, [90, 20]);
    const bound = knowledgeBase('bound', false, [10, 20, 1]);
    bound.entries[2]!.enabled = false;
    const unrelated = knowledgeBase('unrelated', false, [1]);
    const knowledgeBases = [global, bound, unrelated, bound];
    const original = JSON.stringify(knowledgeBases);
    const result = buildSystemMessagesUseCase({
      preset,
      aiCharacter: { id: 'ai', name: '角色', description: '', personality: '', knowledgeBaseId: 'bound', createdAt: 1 },
      knowledgeBases, chatHistory: [], userInstruction: '', mergeMode: 'adjacent',
    });
    const content = result.messages.map(message => message.content).join('\n');
    expect(content.match(/正文-bound-0/g)).toHaveLength(1);
    expect(content).not.toContain('正文-bound-2');
    expect(content).not.toContain('正文-unrelated');
    expect(content).toContain('{{char}}');
    const positions = ['bound-0', 'global-1', 'bound-1', 'global-0'].map(id => content.indexOf(`正文-${id}`));
    expect(positions.every(position => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(JSON.stringify(knowledgeBases)).toBe(original);
  });

  it.each([undefined, 'missing', 'global'])('only includes global knowledge for an absent, missing or global binding (%s)', knowledgeBaseId => {
    const result = buildSystemMessagesUseCase({
      preset: knowledgePreset,
      aiCharacter: { id: 'ai', name: '角色', description: '', personality: '', knowledgeBaseId, createdAt: 1 },
      knowledgeBases: [knowledgeBase('global', true, [50]), knowledgeBase('private', false, [1])],
      chatHistory: [], userInstruction: '', mergeMode: 'adjacent',
    });
    const content = result.messages.map(message => message.content).join('\n');
    expect(content.match(/正文-global-0/g)).toHaveLength(1);
    expect(content).not.toContain('正文-private');
  });

  it('does not inject knowledge when the preset knowledge item is disabled', () => {
    const result = buildSystemMessagesUseCase({
      preset: { ...knowledgePreset, items: knowledgePreset.items.map(item => ({ ...item, enabled: false })) },
      knowledgeBases: [knowledgeBase('global', true, [50])],
      chatHistory: [], userInstruction: '', mergeMode: 'adjacent',
    });
    expect(result.messages).toEqual([]);
  });
});

describe('buildChatSystemMessagesUseCase', () => {
  it('builds fallback messages without requiring Vue state', () => {
    const result = buildSystemMessagesUseCase({
      preset: null,
      aiCharacter: {
        id: 'ai-1',
        name: '汐月',
        description: '猫娘助手',
        personality: '温柔、活泼',
        createdAt: 1,
      },
      knowledgeBases: [],
      chatHistory: [],
      userInstruction: '',
      mergeMode: 'adjacent',
      compressionSummary: '历史摘要',
    });

    expect(result.usedFallback).toBe(true);
    expect(result.messages).toEqual([
      { role: 'system', content: '历史摘要' },
      { role: 'system', content: '你的名字是：汐月\n你的描述：猫娘助手\n你的性格：温柔、活泼' },
    ]);
    expect(result.promptResult.estimatedTokens).toBeGreaterThan(0);
  });

  it('uses one builder path for prompt preset based messages', () => {
    const preset: PromptPreset = {
      ...DEFAULT_PROMPT_PRESETS[0]!,
      items: [...DEFAULT_PROMPT_PRESETS[0]!.items],
    };
    const result = buildSystemMessagesUseCase({
      preset,
      aiCharacter: {
        id: 'ai-1',
        name: '助手',
        description: '默认助手',
        personality: '可靠',
        createdAt: 1,
      },
      knowledgeBases: [],
      chatHistory: [
        { id: 'm1', type: 'user', content: '你好', timestamp: 1 },
      ],
      userInstruction: '继续',
      mergeMode: 'adjacent',
    });

    expect(result.usedFallback).toBe(false);
    expect(result.fullResult).toBeDefined();
    expect(result.messages.some(message => message.content.includes('继续'))).toBe(true);
    expect(result.promptResult.metadata?.presetId).toBe(preset.id);
  });
});
