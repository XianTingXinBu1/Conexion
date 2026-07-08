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

function toChatHistoryMessages(messages: Message[]): ChatMessage[] {
  return messages.map(message => ({
    role: message.type === 'assistant' ? 'assistant' : 'user',
    content: message.content,
  }));
}

function buildFallbackMessages(
  aiCharacter?: AICharacter,
  chatHistory: Message[] = [],
  userInstruction = '',
  compressionSummary?: string,
  includeUserInstructionMessage = true,
): ChatMessage[] {
  const messages: ChatMessage[] = [];

  if (compressionSummary?.trim()) {
    messages.push({
      role: 'system',
      content: compressionSummary.trim(),
    });
  }

  if (aiCharacter) {
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

    if (parts.length > 0) {
      messages.push({
        role: 'system',
        content: parts.join('\n'),
      });
    }
  }

  messages.push(...toChatHistoryMessages(chatHistory));

  if (includeUserInstructionMessage && userInstruction.trim()) {
    messages.push({
      role: 'user',
      content: userInstruction.trim(),
    });
  }

  return messages;
}

export function buildSystemMessagesUseCase(context: BuildSystemMessagesContext): BuildSystemMessagesResult {
  const includeUserInstructionMessage = context.includeUserInstructionMessage !== false;

  if (!context.preset) {
    const messages = buildFallbackMessages(
      context.aiCharacter,
      context.chatHistory,
      context.userInstruction,
      context.compressionSummary,
      includeUserInstructionMessage,
    );

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
    userInstruction: includeUserInstructionMessage ? context.userInstruction : '',
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
