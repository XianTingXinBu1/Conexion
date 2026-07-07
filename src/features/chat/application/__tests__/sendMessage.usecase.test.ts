import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SendMessageUseCase, type SendMessageUseCaseDeps } from '../sendMessage.usecase';
import type { Message } from '@/types';

function createDeps(overrides: Partial<SendMessageUseCaseDeps> = {}) {
  const messages: Message[] = [];
  const requestMessages: Message[] = [];
  const deps: SendMessageUseCaseDeps = {
    getMessages: () => messages,
    getRequestMessages: () => requestMessages,
    getRegexRules: () => [],
    getCurrentCharacter: () => undefined,
    getSelectedUser: () => undefined,
    getKnowledgeBases: () => [],
    getPromptMergeMode: () => 'adjacent',
    getCompressionMode: () => 'manual',
    canUseConversationCompression: () => false,
    isCompressionThresholdReached: () => false,
    compressConversation: vi.fn(async () => true),
    getCompressionSummary: () => '',
    getPersistedConversationId: () => undefined,
    resetUsage: vi.fn(),
    loadRegexRules: vi.fn(async () => undefined),
    createNewConversation: vi.fn(async () => undefined),
    saveConversation: vi.fn(async () => undefined),
    onStreamFlush: vi.fn(),
    onMessageSend: vi.fn(),
    sendStreamChatRequest: vi.fn(async (_messages, onChunk, onComplete) => {
      onChunk('reply');
      await vi.advanceTimersByTimeAsync(60);
      onComplete();
    }),
    buildSystemMessages: vi.fn(() => []),
    onSuccess: vi.fn(),
    onError: vi.fn(),
    ...overrides,
  };

  return { deps, messages, requestMessages };
}

describe('SendMessageUseCase', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('creates user and assistant messages on successful stream', async () => {
    const { deps, messages } = createDeps();
    const useCase = new SendMessageUseCase(deps);

    await useCase.execute('hello');

    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({ type: 'user', content: 'hello' });
    expect(messages[1]).toMatchObject({ type: 'assistant', content: 'reply' });
    expect(deps.createNewConversation).toHaveBeenCalledWith(messages[0]);
    expect(deps.saveConversation).toHaveBeenCalled();
    expect(deps.onSuccess).toHaveBeenCalledWith('send');
  });

  it('reports compression failure and does not send message', async () => {
    const { deps, messages } = createDeps({
      getCompressionMode: () => 'auto',
      canUseConversationCompression: () => true,
      isCompressionThresholdReached: () => true,
      compressConversation: vi.fn(async () => { throw new Error('boom'); }),
    });
    const useCase = new SendMessageUseCase(deps);

    await useCase.execute('hello');

    expect(messages).toHaveLength(0);
    expect(deps.sendStreamChatRequest).not.toHaveBeenCalled();
    expect(deps.onError).toHaveBeenCalledWith('compression', 'boom');
  });

  it('predicts the outgoing user message when deciding pre-send auto compression', async () => {
    const compressConversation = vi.fn(async () => true);
    const { deps } = createDeps({
      getCompressionMode: () => 'auto',
      canUseConversationCompression: () => true,
      isCompressionThresholdReached: vi.fn((messages?: Message[]) => Boolean(
        messages?.some(message => message.content === 'hello')
        && !messages?.some(message => message.type === 'assistant')
      )),
      compressConversation,
    });
    const useCase = new SendMessageUseCase(deps);

    await useCase.execute('hello');

    expect(compressConversation).toHaveBeenCalledTimes(1);
    expect(deps.sendStreamChatRequest).toHaveBeenCalledTimes(1);
  });

  it('runs auto compression after final assistant reply is saved', async () => {
    const events: string[] = [];
    const compressedSnapshots: Message[][] = [];
    let thresholdReached = false;
    const compressConversation = vi.fn(async () => {
      events.push('compress');
      compressedSnapshots.push(messages.map(message => ({ ...message })));
      return true;
    });
    const { deps, messages } = createDeps({
      getCompressionMode: () => 'auto',
      canUseConversationCompression: () => true,
      isCompressionThresholdReached: () => thresholdReached,
      compressConversation,
      createNewConversation: vi.fn(async (firstMessage) => {
        events.push(`create:${firstMessage.type}:${firstMessage.content}`);
      }),
      saveConversation: vi.fn(async () => {
        const lastMessage = messages[messages.length - 1];
        events.push(`save:${lastMessage?.type}:${lastMessage?.content || '<empty>'}`);
      }),
      sendStreamChatRequest: vi.fn(async (_messages, onChunk, onComplete) => {
        onChunk('完整');
        onChunk('回复');
        thresholdReached = true;
        await vi.advanceTimersByTimeAsync(60);
        await onComplete();
      }),
    });
    const useCase = new SendMessageUseCase(deps);

    await useCase.execute('hello');

    expect(compressConversation).toHaveBeenCalledTimes(1);
    const compressedSnapshot = compressedSnapshots[0] ?? [];
    expect(compressedSnapshot[compressedSnapshot.length - 1]).toMatchObject({
      type: 'assistant',
      content: '完整回复',
    });
    expect(events).toEqual([
      'create:user:hello',
      'save:assistant:完整回复',
      'compress',
    ]);
    expect(deps.onSuccess).toHaveBeenCalledWith('send');
  });

  it('marks empty cancelled response as stopped', async () => {
    const { deps, messages } = createDeps({
      sendStreamChatRequest: vi.fn(async (_messages, _onChunk, _onComplete, onError) => {
        onError('请求已取消');
      }),
    });
    const useCase = new SendMessageUseCase(deps);

    await useCase.execute('hello');

    expect(messages[1]).toMatchObject({ type: 'assistant', content: '已停止生成' });
    expect(deps.onError).not.toHaveBeenCalledWith('send', expect.anything());
  });
});
