import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SendMessageUseCase, type SendMessageUseCaseDeps } from '../sendMessage.usecase';
import { getActiveVariantIndex } from '../messageVariants';
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

  it.each([false, true])('keeps input unaccepted and rolls back user insertion on persistence failure (existing: %s)', async existing => {
    const fail = vi.fn(async () => { throw new Error('保存失败'); });
    const { deps, messages } = createDeps({
      getPersistedConversationId: () => existing ? 'conv-one' : undefined,
      createNewConversation: fail,
      saveConversation: fail,
    });
    await expect(new SendMessageUseCase(deps).execute('原文')).rejects.toThrow('保存失败');
    expect(messages).toEqual([]);
    expect(deps.onMessageSend).not.toHaveBeenCalled();
    expect(deps.sendStreamChatRequest).not.toHaveBeenCalled();
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

  it('取消时的占位文案会再落一次盘', async () => {
    const saveConversation = vi.fn(async () => undefined);
    const { deps, messages } = createDeps({
      saveConversation,
      sendStreamChatRequest: vi.fn(async (_messages, _onChunk, _onComplete, onError) => {
        onError('请求已取消');
      }),
    });

    await new SendMessageUseCase(deps).execute('hello');

    expect(messages[1]).toMatchObject({ type: 'assistant', content: '已停止生成' });
    // 一次是 finalizeSend，一次是写完占位文案后：
    // 只保存一次的话刷新后「已停止生成」会变回空回复
    expect(saveConversation.mock.calls.length).toBe(2);
  });

  it('收尾保存失败时上报错误，不静默当成功', async () => {
    let saveCallCount = 0;
    const saveConversation = vi.fn(async () => {
      saveCallCount += 1;
      // 只让收尾那次失败：错误文案本身还要落盘
      if (saveCallCount === 2) {
        throw new Error('收尾保存失败');
      }
    });

    const { deps } = createDeps({
      // 已有会话：execute 开头直接走 saveConversation，第 2 次才是 finalizeSend
      getPersistedConversationId: () => 'conv-existing',
      saveConversation,
      sendStreamChatRequest: vi.fn(async (_messages, onChunk, onComplete) => {
        onChunk('reply');
        await vi.advanceTimersByTimeAsync(60);
        await onComplete();
      }),
    });

    await new SendMessageUseCase(deps).execute('hello');

    expect(deps.onSuccess).not.toHaveBeenCalledWith('send');
    expect(deps.onError).toHaveBeenCalledWith('send', expect.stringContaining('收尾保存失败'));
  });

  it('发送进行中时重复触发不会重复发请求或重复插消息', async () => {
    let releaseStream: (() => void) | undefined;
    const streamGate = new Promise<void>((resolve) => {
      releaseStream = resolve;
    });

    const sendStreamChatRequest = vi.fn(async (_messages, onChunk, onComplete) => {
      await streamGate;
      onChunk('reply');
      await vi.advanceTimersByTimeAsync(60);
      await onComplete();
    });

    const { deps, messages } = createDeps({ sendStreamChatRequest });
    const useCase = new SendMessageUseCase(deps);

    const firstSend = useCase.execute('hello');
    // 让第一次调用真正进入流式阶段
    await vi.advanceTimersByTimeAsync(0);

    await useCase.execute('second');

    releaseStream!();
    await firstSend;

    expect(sendStreamChatRequest).toHaveBeenCalledTimes(1);
    expect(messages.filter(message => message.type === 'user')).toHaveLength(1);
    expect(messages.filter(message => message.type === 'assistant')).toHaveLength(1);
  });
});

describe('SendMessageUseCase.regenerate', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  const seedConversation = (
    messages: Message[],
    requestMessages: Message[],
  ): { user: Message; assistant: Message } => {
    const user: Message = { id: 'm1', type: 'user', content: 'hello', timestamp: 1 };
    const assistant: Message = { id: 'm2', type: 'assistant', content: 'first', timestamp: 2 };

    messages.push(user, assistant);
    requestMessages.push({ ...user }, { ...assistant });

    return { user, assistant };
  };

  it('给同一条消息追加变体，不新增消息', async () => {
    const { deps, messages, requestMessages } = createDeps();
    seedConversation(messages, requestMessages);

    const useCase = new SendMessageUseCase(deps);
    await useCase.regenerate('m2');

    expect(messages).toHaveLength(2);
    expect(messages[1]).toMatchObject({ type: 'assistant', content: 'reply', activeVariantIndex: 1 });
    expect(messages[1]!.variants).toEqual(['first', 'reply']);
    expect(deps.saveConversation).toHaveBeenCalled();
    expect(deps.onSuccess).toHaveBeenCalledWith('retry');
  });

  it('复现原回合请求：用户指令只出现一次', async () => {
    const { deps, messages, requestMessages } = createDeps();
    seedConversation(messages, requestMessages);

    const useCase = new SendMessageUseCase(deps);
    await useCase.regenerate('m2');

    expect(deps.buildSystemMessages).toHaveBeenCalledWith(
      expect.objectContaining({ chatHistory: [], userInstruction: 'hello' }),
    );
  });

  it('多次重试累积变体而不是互相覆盖', async () => {
    const { deps, messages, requestMessages } = createDeps();
    seedConversation(messages, requestMessages);

    const useCase = new SendMessageUseCase(deps);
    await useCase.regenerate('m2');
    await useCase.regenerate('m2');

    expect(messages[1]!.variants).toEqual(['first', 'reply', 'reply']);
    expect(getActiveVariantIndex(messages[1]!)).toBe(2);
  });

  it('取消且没有内容时回滚空变体，保留原回复', async () => {
    const { deps, messages, requestMessages } = createDeps({
      sendStreamChatRequest: vi.fn(async (_messages, _onChunk, _onComplete, onError) => {
        onError('请求已取消');
      }),
    });
    seedConversation(messages, requestMessages);

    const useCase = new SendMessageUseCase(deps);
    await useCase.regenerate('m2');

    expect(messages[1]).toMatchObject({ content: 'first' });
    expect(messages[1]!.variants).toBeUndefined();
    expect(deps.onError).not.toHaveBeenCalled();
    expect(deps.saveConversation).toHaveBeenCalled();
  });

  it('取消但已有内容时把部分回复留作新变体', async () => {
    const { deps, messages, requestMessages } = createDeps({
      sendStreamChatRequest: vi.fn(async (_messages, onChunk, _onComplete, onError) => {
        onChunk('半截');
        await vi.advanceTimersByTimeAsync(60);
        onError('请求已取消');
      }),
    });
    seedConversation(messages, requestMessages);

    const useCase = new SendMessageUseCase(deps);
    await useCase.regenerate('m2');

    expect(messages[1]!.variants).toEqual(['first', '半截']);
    expect(messages[1]!.content).toBe('半截');
  });

  it('只接受最后一条 assistant 消息', async () => {
    const { deps, messages, requestMessages } = createDeps();
    const { assistant } = seedConversation(messages, requestMessages);
    messages.push({ id: 'm3', type: 'user', content: 'next', timestamp: 3 });

    const useCase = new SendMessageUseCase(deps);
    await useCase.regenerate(assistant.id);

    expect(deps.sendStreamChatRequest).not.toHaveBeenCalled();
    expect(deps.onSuccess).not.toHaveBeenCalled();
  });

  it('目标是用户消息时是空操作', async () => {
    const { deps, messages, requestMessages } = createDeps();
    const { user } = seedConversation(messages, requestMessages);

    const useCase = new SendMessageUseCase(deps);
    await useCase.regenerate(user.id);

    expect(deps.sendStreamChatRequest).not.toHaveBeenCalled();
  });
});
