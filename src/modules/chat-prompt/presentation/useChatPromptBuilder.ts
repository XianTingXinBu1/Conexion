import { ref } from 'vue';
import type { AICharacter, ChatMessage, KnowledgeBase, Message, PromptPreset, UserCharacter } from '@/types';
import type { MergeMode } from '@/modules/system-prompt';
import { logPrompt, logSystemPrompt } from '@/modules/debug';
import {
  loadPromptPresets as loadPromptPresetsFromRepository,
  loadSelectedPromptPresetId,
} from '@/repositories/promptPresetRepository';
import { buildSystemMessagesUseCase } from '../application/buildChatSystemMessages.usecase';

interface LastSystemPromptResult {
  estimatedTokens: number;
  metadata?: {
    filledPlaceholders?: Record<string, {
      placeholder?: 'character' | 'user' | 'knowledge' | 'chat-history' | 'user-instruction';
      contentLength: number;
    }>;
    totalItems: number;
    enabledItems: number;
  };
}

interface BuildPromptContext {
  aiCharacter?: AICharacter;
  userCharacter?: UserCharacter;
  knowledgeBases: KnowledgeBase[];
  chatHistory: Message[];
  userInstruction: string;
  mergeMode: MergeMode;
  includeUserInstructionMessage?: boolean;
  compressionSummary?: string;
}

export function useChatPromptBuilder() {
  const promptPresets = ref<PromptPreset[]>([]);
  const selectedPromptPresetId = ref<string>('default');
  const lastSystemPromptResult = ref<LastSystemPromptResult | null>(null);
  const lastSystemMessages = ref<ChatMessage[]>([]);
  const showPromptPreview = ref(false);

  const loadPromptPresets = async () => {
    promptPresets.value = await loadPromptPresetsFromRepository();

    const selectedId = await loadSelectedPromptPresetId();
    if (selectedId) {
      const exists = promptPresets.value.some(p => p.id === selectedId);
      if (exists) {
        selectedPromptPresetId.value = selectedId;
      }
    }
  };

  const getCurrentPromptPreset = (): PromptPreset | null => {
    return promptPresets.value.find(p => p.id === selectedPromptPresetId.value) || null;
  };

  const buildSystemMessages = (context: BuildPromptContext): ChatMessage[] => {
    const currentPreset = getCurrentPromptPreset();

    if (currentPreset) {
      logPrompt('使用提示词预设', { presetName: currentPreset.name, itemCount: currentPreset.items.length });
    } else {
      logPrompt('未找到提示词预设，使用默认构建');
    }

    const result = buildSystemMessagesUseCase({
      ...context,
      preset: currentPreset,
    });

    lastSystemMessages.value = result.messages;
    lastSystemPromptResult.value = result.promptResult;

    if (currentPreset && result.fullResult) {
      logSystemPrompt({
        presetName: currentPreset.name,
        messageCount: result.fullResult.messages.length,
        usedItems: result.fullResult.usedItemIds.length,
        skippedItems: result.fullResult.skippedItemIds.length,
        estimatedTokens: result.fullResult.estimatedTokens,
        userInstructionIncluded: result.fullResult.userInstructionIncluded,
        allItems: currentPreset.items.map(item => ({
          id: item.id,
          name: item.name,
          enabled: item.enabled,
          insertPosition: item.insertPosition,
        })),
        enabledItems: currentPreset.items.filter(item => item.enabled).map(item => ({
          id: item.id,
          name: item.name,
          insertPosition: item.insertPosition,
        })),
        messages: result.fullResult.messages.map(msg => ({
          role: msg.role,
          content: msg.content,
        })),
      });
    }

    return result.messages;
  };

  const showPromptAssistant = (context: Omit<BuildPromptContext, 'userInstruction'>) => {
    const currentPreset = getCurrentPromptPreset();

    if (currentPreset) {
      logPrompt('实时构建提示词预览', { presetName: currentPreset.name, itemCount: currentPreset.items.length });
    } else {
      logPrompt('实时构建提示词预览（默认）');
    }

    buildSystemMessages({
      ...context,
      userInstruction: '',
    });
    showPromptPreview.value = true;
  };

  return {
    promptPresets,
    selectedPromptPresetId,
    lastSystemPromptResult,
    lastSystemMessages,
    showPromptPreview,
    loadPromptPresets,
    getCurrentPromptPreset,
    buildSystemMessages,
    showPromptAssistant,
  };
}
