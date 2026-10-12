import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import { useChatSendFlow } from '../useChatSendFlow';
import type { AICharacter, ChatMessage, Message, RegexRule, UserCharacter } from '@/types';

vi.mock('@/modules/notification', () => ({
  getNotificationMessage: vi.fn(() => ({ title: 'ok', message: 'done' })),
}));

const toGroupedDeps = (deps: any) => ({
  state: {
    messages: deps.messages,
    requestMessages: deps.requestMessages,
    regexRules: deps.regexRules,
    currentCharacter: deps.currentCharacter,
    selectedUser: deps.selectedUser,
    knowledgeBases: deps.knowledgeBases,
    promptMergeMode: deps.promptMergeMode,
  },
  compression: {
    mode: deps.compressionMode,
    canUse: deps.canUseConversationCompression,
    thresholdReached: deps.isCompressionThresholdReached,
    thresholdPercent: deps.compressionThresholdPercent ?? ref(75),
    maxContextLength: deps.maxContextLength ?? ref(4096),
    currentCompression: deps.currentCompression ?? ref(undefined),
    compress: deps.compressConversation,
    isCompressing: deps.isCompressingConversation,
    summary: deps.compressionSummary,
  },
  session: {
    persistedConversationId: deps.persistedConversationId,
    createNewConversation: deps.createNewConversation,
    saveConversation: deps.saveConversation,
  },
  transport: {
    resetUsage: deps.resetUsage,
    resolveContextTokens: deps.resolveContextTokens,
    loadRegexRules: deps.loadRegexRules,
    sendStreamChatRequest: deps.sendStreamChatRequest,
    cancelRequest: deps.cancelRequest,
    buildSystemMessages: deps.buildSystemMessages,
  },
  uiEffects: {
    onStreamFlush: deps.onStreamFlush,
    onMessageSend: deps.onMessageSend,
    showSuccess: deps.showSuccess,
    showError: deps.showError,
  },
});

describe('useChatSendFlow', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('sends current user message exactly once even without user-instruction preset item', async () => {
    const messages = ref<Message[]>([]);
    const requestMessages = ref<Message[]>([]);
    const regexRules = ref<RegexRule[]>([]);
    const sentMessages: ChatMessage[][] = [];

    const deps = {
      messages,
      requestMessages,
      regexRules,
      currentCharacter: { value: undefined as AICharacter | undefined },
      selectedUser: { value: undefined as UserCharacter | undefined },
      knowledgeBases: { value: [] },
      promptMergeMode: ref<'adjacent'>('adjacent'),
      compressionMode: ref<'manual' | 'auto'>('manual'),
      canUseConversationCompression: ref(false),
      isCompressionThresholdReached: ref(false),
      compressConversation: vi.fn(async () => true),
      isCompressingConversation: ref(false),
      compressionSummary: ref(''),
      persistedConversationId: { value: undefined },
      resetUsage: vi.fn(),
      loadRegexRules: vi.fn(async () => undefined),
      createNewConversation: vi.fn(async () => undefined),
      saveConversation: vi.fn(async () => undefined),
      onStreamFlush: vi.fn(),
      onMessageSend: vi.fn(async () => undefined),
      sendStreamChatRequest: vi.fn(async (requestMessages: ChatMessage[], onChunk, onComplete) => {
        sentMessages.push(requestMessages.map(message => ({ ...message })));
        onChunk('reply');
        await vi.advanceTimersByTimeAsync(60);
        await onComplete();
      }),
      cancelRequest: vi.fn(),
      buildSystemMessages: vi.fn((context) => [{ role: 'user' as const, content: context.userInstruction }]),
      showSuccess: vi.fn(),
      showError: vi.fn(),
    };

    const { handleSendMessage } = useChatSendFlow(toGroupedDeps(deps));
    await handleSendMessage('hello');

    expect(sentMessages).toHaveLength(1);
    expect(sentMessages[0]).toHaveLength(1);
    expect(sentMessages[0]?.[0]?.role).toBe('user');
    expect(sentMessages[0]?.[0]?.content).toBe('hello');
    expect(deps.buildSystemMessages).toHaveBeenCalledWith(expect.objectContaining({
      userInstruction: 'hello',
      includeUserInstructionMessage: true,
    }));
  });

  it('skips auto compression for temporary conversations even when threshold is reached', async () => {
    const messages = ref<Message[]>([]);
    const requestMessages = ref<Message[]>([]);
    const regexRules = ref<RegexRule[]>([]);
    const compressConversation = vi.fn(async () => true);

    const deps = {
      messages,
      requestMessages,
      regexRules,
      currentCharacter: { value: undefined as AICharacter | undefined },
      selectedUser: { value: undefined as UserCharacter | undefined },
      knowledgeBases: { value: [] },
      promptMergeMode: ref<'adjacent'>('adjacent'),
      compressionMode: ref<'manual' | 'auto'>('auto'),
      canUseConversationCompression: ref(false),
      isCompressionThresholdReached: ref(true),
      compressConversation,
      isCompressingConversation: ref(false),
      compressionSummary: ref(''),
      persistedConversationId: { value: 'temp-123' },
      resetUsage: vi.fn(),
      loadRegexRules: vi.fn(async () => undefined),
      createNewConversation: vi.fn(async () => undefined),
      saveConversation: vi.fn(async () => undefined),
      onStreamFlush: vi.fn(),
      onMessageSend: vi.fn(async () => undefined),
      sendStreamChatRequest: vi.fn(async (_requestMessages: ChatMessage[], onChunk, onComplete) => {
        onChunk('reply');
        await vi.advanceTimersByTimeAsync(60);
        await onComplete();
      }),
      cancelRequest: vi.fn(),
      buildSystemMessages: vi.fn(() => []),
      showSuccess: vi.fn(),
      showError: vi.fn(),
    };

    const { handleSendMessage } = useChatSendFlow(toGroupedDeps(deps));
    await handleSendMessage('hello');

    expect(compressConversation).not.toHaveBeenCalled();
    expect(deps.sendStreamChatRequest).toHaveBeenCalledTimes(1);
  });

  it('自动压缩按完整提示词和统一的实际输入基准判断，包含角色设定和知识库', async () => {
    const request: ChatMessage[] = [{ role: 'system', content: '角色设定与知识库' }, { role: 'user', content: '继续' }];
    const compress = vi.fn(async () => true);
    const resolveTokens = vi.fn(() => ({ tokens: 800 }));
    const build = vi.fn(() => request);
    const send = vi.fn(async () => undefined);
    const flow = useChatSendFlow({
      state: {
        messages: ref([]), requestMessages: ref([]), regexRules: ref([]),
        currentCharacter: ref(undefined), selectedUser: ref(undefined), knowledgeBases: ref([]),
        promptMergeMode: ref('adjacent'),
      },
      compression: {
        mode: ref('auto'), canUse: ref(true), thresholdReached: ref(false),
        thresholdPercent: ref(75), maxContextLength: ref(1000), currentCompression: ref(undefined),
        compress, isCompressing: ref(false), summary: ref(''),
      },
      session: { persistedConversationId: ref('conv-1'), createNewConversation: vi.fn(), saveConversation: vi.fn() },
      transport: {
        resetUsage: vi.fn(), loadRegexRules: vi.fn(), sendStreamChatRequest: send,
        cancelRequest: vi.fn(), buildSystemMessages: build, resolveContextTokens: resolveTokens,
      },
      uiEffects: { onStreamFlush: vi.fn(), onMessageSend: vi.fn(), showSuccess: vi.fn(), showError: vi.fn() },
    });
    await flow.handleSendMessage('继续');
    expect(resolveTokens).toHaveBeenCalledWith(request);
    expect(compress).toHaveBeenCalledOnce();
    expect(send).toHaveBeenCalledOnce();
    expect(build).toHaveBeenCalledWith(expect.objectContaining({ userInstruction: '继续', includeUserInstructionMessage: true }));
  });

  it('does not re-apply non-idempotent assistant regex rules to old streamed content', async () => {
    const messages = ref<Message[]>([]);
    const requestMessages = ref<Message[]>([]);
    const regexRules = ref<RegexRule[]>([
      {
        id: 'r1',
        name: 'duplicate a',
        enabled: true,
        pattern: 'a',
        flags: 'g',
        replacement: 'aa',
        scope: 'assistant',
        applyTo: 'after-macro',
      },
    ]);

    const deps = {
      messages,
      requestMessages,
      regexRules,
      currentCharacter: { value: undefined as AICharacter | undefined },
      selectedUser: { value: undefined as UserCharacter | undefined },
      knowledgeBases: { value: [] },
      promptMergeMode: ref<'adjacent'>('adjacent'),
      compressionMode: ref<'manual' | 'auto'>('manual'),
      canUseConversationCompression: ref(false),
      isCompressionThresholdReached: ref(false),
      compressConversation: vi.fn(async () => true),
      isCompressingConversation: ref(false),
      compressionSummary: ref(''),
      persistedConversationId: { value: undefined },
      resetUsage: vi.fn(),
      loadRegexRules: vi.fn(async () => undefined),
      createNewConversation: vi.fn(async () => undefined),
      saveConversation: vi.fn(async () => undefined),
      onStreamFlush: vi.fn(),
      onMessageSend: vi.fn(async () => undefined),
      sendStreamChatRequest: vi.fn(async (_requestMessages: ChatMessage[], onChunk, onComplete) => {
        onChunk('a');
        await vi.advanceTimersByTimeAsync(60);
        onChunk('a');
        await vi.advanceTimersByTimeAsync(60);
        await onComplete();
      }),
      cancelRequest: vi.fn(),
      buildSystemMessages: vi.fn(() => []),
      showSuccess: vi.fn(),
      showError: vi.fn(),
    };

    const { handleSendMessage } = useChatSendFlow(toGroupedDeps(deps));
    await handleSendMessage('go');

    const assistantMessage = messages.value.find(message => message.type === 'assistant');
    expect(assistantMessage?.content).toBe('aaaa');
  });
});
