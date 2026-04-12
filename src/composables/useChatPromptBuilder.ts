import { ref } from 'vue';
import type { AICharacter, ChatMessage, KnowledgeBase, Message, PromptPreset, UserCharacter } from '../types';
import type { MergeMode } from '../modules/system-prompt';
import { STORAGE_KEYS, DEFAULT_PROMPT_PRESETS } from '../constants';
import { getStorage } from '@/utils/storage';
import { buildSystemPrompt } from '../modules/system-prompt';
import { logPrompt, logSystemPrompt } from '../modules/debug';

interface LastSystemPromptResult {
  estimatedTokens: number;
  metadata?: {
    filledPlaceholders?: Record<string, { contentLength: number }>;
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
}

export function useChatPromptBuilder() {
  const promptPresets = ref<PromptPreset[]>([]);
  const selectedPromptPresetId = ref<string>('default');
  const lastSystemPromptResult = ref<LastSystemPromptResult | null>(null);
  const lastSystemMessages = ref<ChatMessage[]>([]);
  const showPromptPreview = ref(false);

  const loadPromptPresets = async () => {
    const stored = await getStorage<PromptPreset[]>(
      STORAGE_KEYS.PROMPT_PRESETS,
      [...DEFAULT_PROMPT_PRESETS].map(p => ({
        ...p,
        items: [...p.items],
      }))
    );

    if (stored) {
      promptPresets.value = stored;
    }

    const selectedId = await getStorage<string>(STORAGE_KEYS.SELECTED_PROMPT_PRESET, '');
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

  const buildFallbackSystemMessages = (aiCharacter?: AICharacter): ChatMessage[] => {
    if (!aiCharacter) return [];

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

    if (parts.length === 0) return [];

    return [
      {
        role: 'system' as const,
        content: parts.join('\n'),
      },
    ];
  };

  const buildSystemMessages = (context: BuildPromptContext): ChatMessage[] => {
    const currentPreset = getCurrentPromptPreset();
    let systemMessages: ChatMessage[] = [];

    if (currentPreset) {
      logPrompt('使用提示词预设', { presetName: currentPreset.name, itemCount: currentPreset.items.length });
      const result = buildSystemPrompt({
        preset: currentPreset,
        aiCharacter: context.aiCharacter,
        userCharacter: context.userCharacter,
        knowledgeBases: context.knowledgeBases.filter(kb => kb.globallyEnabled),
        chatHistory: context.chatHistory,
        userInstruction: context.userInstruction,
        mergeMode: context.mergeMode,
      });

      systemMessages = result.messages;
      lastSystemMessages.value = systemMessages;
      lastSystemPromptResult.value = {
        estimatedTokens: result.estimatedTokens,
        metadata: result.metadata,
      };

      logSystemPrompt({
        presetName: currentPreset.name,
        messageCount: result.messages.length,
        usedItems: result.usedItemIds.length,
        skippedItems: result.skippedItemIds.length,
        estimatedTokens: result.estimatedTokens,
        userInstructionIncluded: result.userInstructionIncluded,
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
        messages: result.messages.map(msg => ({
          role: msg.role,
          content: msg.content,
        })),
      });

      return systemMessages;
    }

    logPrompt('未找到提示词预设，使用默认构建');
    systemMessages = buildFallbackSystemMessages(context.aiCharacter);
    lastSystemMessages.value = systemMessages;
    lastSystemPromptResult.value = {
      estimatedTokens: systemMessages.reduce((sum, msg) => sum + msg.content.length, 0),
    };

    return systemMessages;
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
