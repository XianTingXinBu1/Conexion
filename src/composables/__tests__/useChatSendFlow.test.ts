import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import { useChatSendFlow } from '../useChatSendFlow';
import type { AICharacter, Message, RegexRule, UserCharacter } from '@/types';

vi.mock('@/modules/notification', () => ({
  getNotificationMessage: vi.fn(() => ({ title: 'ok', message: 'done' })),
}));

describe('useChatSendFlow', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('sends current user message exactly once even without user-instruction preset item', async () => {
    const messages = ref<Message[]>([]);
    const regexRules = ref<RegexRule[]>([]);
    const sentMessages: Message[][] = [];

    const deps = {
      messages,
      regexRules,
      currentCharacter: { value: undefined as AICharacter | undefined },
      selectedUser: { value: undefined as UserCharacter | undefined },
      knowledgeBases: { value: [] },
      promptMergeMode: ref<'adjacent'>('adjacent'),
      persistedConversationId: { value: undefined },
      resetUsage: vi.fn(),
      loadRegexRules: vi.fn(async () => undefined),
      createNewConversation: vi.fn(async () => undefined),
      saveConversation: vi.fn(async () => undefined),
      onStreamFlush: vi.fn(),
      onMessageSend: vi.fn(async () => undefined),
      sendStreamChatRequest: vi.fn(async (requestMessages: Message[], onChunk, onComplete) => {
        sentMessages.push(requestMessages.map(message => ({ ...message })));
        onChunk('reply');
        await vi.advanceTimersByTimeAsync(60);
        await onComplete();
      }),
      cancelRequest: vi.fn(),
      buildSystemMessages: vi.fn(() => [{ role: 'system' as const, content: 'system only' }]),
      showSuccess: vi.fn(),
      showError: vi.fn(),
    };

    const { handleSendMessage } = useChatSendFlow(deps);
    await handleSendMessage('hello');

    expect(sentMessages).toHaveLength(1);
    expect(sentMessages[0]).toHaveLength(1);
    expect(sentMessages[0]?.[0]?.type).toBe('user');
    expect(sentMessages[0]?.[0]?.content).toBe('hello');
    expect(deps.buildSystemMessages).toHaveBeenCalledWith(expect.objectContaining({
      userInstruction: 'hello',
      includeUserInstructionMessage: false,
    }));
  });

  it('does not re-apply non-idempotent assistant regex rules to old streamed content', async () => {
    const messages = ref<Message[]>([]);
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
      regexRules,
      currentCharacter: { value: undefined as AICharacter | undefined },
      selectedUser: { value: undefined as UserCharacter | undefined },
      knowledgeBases: { value: [] },
      promptMergeMode: ref<'adjacent'>('adjacent'),
      persistedConversationId: { value: undefined },
      resetUsage: vi.fn(),
      loadRegexRules: vi.fn(async () => undefined),
      createNewConversation: vi.fn(async () => undefined),
      saveConversation: vi.fn(async () => undefined),
      onStreamFlush: vi.fn(),
      onMessageSend: vi.fn(async () => undefined),
      sendStreamChatRequest: vi.fn(async (_requestMessages: Message[], onChunk, onComplete) => {
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

    const { handleSendMessage } = useChatSendFlow(deps);
    await handleSendMessage('go');

    const assistantMessage = messages.value.find(message => message.type === 'assistant');
    expect(assistantMessage?.content).toBe('aaaa');
  });
});
