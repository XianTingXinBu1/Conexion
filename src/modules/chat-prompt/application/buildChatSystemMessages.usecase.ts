import type { AICharacter, ChatMessage, KnowledgeBase, Message, PromptPreset, UserCharacter } from '@/types';
import { countMessagesTokens } from '@/utils/tokenCounter';
import type { MergeMode, SystemPromptResult } from '@/modules/system-prompt';
import { buildSystemPrompt } from '@/modules/system-prompt';
import { fillItemContent } from '@/modules/system-prompt/core/content-filler';

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
  knowledgeBases: KnowledgeBase[] = [],
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

  const knowledge = fillItemContent(
    { id: 'knowledge-base', name: '知识库', description: '', enabled: true, prompt: '', roleType: 'system' },
    { aiCharacter, knowledgeBases, chatHistory, userInstruction },
  );
  if (knowledge.content) {
    messages.push({ role: 'system', content: knowledge.content });
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
      context.knowledgeBases,
    );

    return {
      messages,
      promptResult: {
        estimatedTokens: countMessagesTokens(messages),
      },
      usedFallback: true,
    };
  }

  const fullResult = buildSystemPrompt({
    preset: context.preset,
    aiCharacter: context.aiCharacter,
    userCharacter: context.userCharacter,
    knowledgeBases: context.knowledgeBases,
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
