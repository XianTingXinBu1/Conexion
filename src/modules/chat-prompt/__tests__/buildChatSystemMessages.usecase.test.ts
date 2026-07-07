import { describe, expect, it } from 'vitest';
import { DEFAULT_PROMPT_PRESETS } from '@/constants';
import type { PromptPreset } from '@/types';
import { buildSystemMessagesUseCase } from '../application/buildChatSystemMessages.usecase';

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
