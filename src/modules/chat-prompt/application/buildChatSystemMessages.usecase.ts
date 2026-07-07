import type { AICharacter, ChatMessage, KnowledgeBase, Message, PromptPreset, UserCharacter } from '@/types';
import type { MergeMode, SystemPromptResult } from '@/modules/system-prompt';
import { buildSystemPrompt } from '@/modules/system-prompt';

export interface BuildSystemMessagesContext {
  preset: PromptPreset | null;
  aiCharacter?: AICharacter;
  userCharacter?: UserCharacter;
  knowledgeBases: KnowledgeBase[];
  chatHistory: Message[];
  userInstruction: string;
  mergeMode: MergeMode;
  includeUserInstructionMessage?: boolean;
  compressionSummary?: string;
}

export interface BuildSystemMessagesResult {
  messages: ChatMessage[];
  promptResult: {
    estimatedTokens: number;
    metadata?: SystemPromptResult['metadata'];
  };
  fullResult?: SystemPromptResult;
  usedFallback: boolean;
}

function buildFallbackSystemMessages(aiCharacter?: AICharacter, compressionSummary?: string): ChatMessage[] {
  const messages: ChatMessage[] = [];

  if (compressionSummary?.trim()) {
    messages.push({
      role: 'system',
      content: compressionSummary.trim(),
    });
  }

  if (!aiCharacter) return messages;

  const parts: string[] = [];
  if (aiCharacter.name) {
    parts.push(`你的名字是：${aiCharacter.name}`);
  }
  if (aiCharacter.description) {
    parts.push(`你的描述：${aiCharacter.description}`);
  }
  if (aiCharacter.personality) {
    parts.push(`你的性格：${aiCharacter.personality}`);
  }

  if (parts.length === 0) return messages;

  messages.push({
    role: 'system',
    content: parts.join('\n'),
  });

  return messages;
}

export function buildSystemMessagesUseCase(context: BuildSystemMessagesContext): BuildSystemMessagesResult {
  if (!context.preset) {
    const messages = buildFallbackSystemMessages(context.aiCharacter, context.compressionSummary);
    return {
      messages,
      promptResult: {
        estimatedTokens: messages.reduce((sum, message) => sum + message.content.length, 0),
      },
      usedFallback: true,
    };
  }

  const fullResult = buildSystemPrompt({
    preset: context.preset,
    aiCharacter: context.aiCharacter,
    userCharacter: context.userCharacter,
    knowledgeBases: context.knowledgeBases.filter(kb => kb.globallyEnabled),
    chatHistory: context.chatHistory,
    userInstruction: context.includeUserInstructionMessage === false ? '' : context.userInstruction,
    mergeMode: context.mergeMode,
    compressionSummary: context.compressionSummary,
  });

  return {
    messages: fullResult.messages,
    promptResult: {
      estimatedTokens: fullResult.estimatedTokens,
      metadata: fullResult.metadata,
    },
    fullResult,
    usedFallback: false,
  };
}
