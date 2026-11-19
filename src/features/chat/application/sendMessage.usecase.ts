import type { AICharacter, ChatMessage, KnowledgeBase, Message, RegexRule, UserCharacter } from '@/types';
import type { MacroContext, MergeMode } from '@/modules/system-prompt';
import { REQUEST_CANCELLED_MESSAGE } from '@/api/errors';
import { processChatContent } from './chatContentPipeline';
import { StreamMessageAssembler } from './streamMessageAssembler';
import { applyVariantContent, beginNewVariant, revertLastVariant } from './messageVariants';
import { createId } from '@/utils/id';

export interface SendMessageUseCaseDeps {
  getMessages: () => Message[];
  getRequestMessages: () => Message[];
  getRegexRules: () => RegexRule[];
  getCurrentCharacter: () => AICharacter | undefined;
  getSelectedUser: () => UserCharacter | undefined;
  getKnowledgeBases: () => KnowledgeBase[];
  getPromptMergeMode: () => MergeMode;
  getCompressionMode: () => 'manual' | 'auto';
  canUseConversationCompression: () => boolean;
  isCompressionThresholdReached: (messages?: Message[]) => boolean;
  compressConversation: (options?: { keepRecentCount?: number }) => Promise<boolean>;
  getCompressionSummary: () => string;
  getPersistedConversationId: () => string | undefined;
  resetUsage: () => void;
  loadRegexRules: () => Promise<void>;
  createNewConversation: (firstMessage: Message) => Promise<unknown>;
  saveConversation: () => Promise<void>;
  onStreamFlush: () => void;
  onMessageSend: () => void;
  sendStreamChatRequest: (
    messages: ChatMessage[],
    onChunk: (chunk: string) => void,
    onComplete: () => void | Promise<void>,
    onError: (error: string) => void | Promise<void>,
    onReasoningChunk?: (chunk: string) => void,
  ) => Promise<void>;
  buildSystemMessages: (context: {
    aiCharacter?: AICharacter;
    userCharacter?: UserCharacter;
    knowledgeBases: KnowledgeBase[];
    chatHistory: Message[];
    userInstruction: string;
    mergeMode: MergeMode;
    includeUserInstructionMessage?: boolean;
    compressionSummary?: string;
  }) => ChatMessage[];
  onSuccess: (kind: 'send' | 'retry' | 'compression') => void;
  onError: (kind: 'send' | 'compression', error: string) => void;
}

export interface SendMessageUseCaseOptions {
  flushIntervalMs?: number;
}

export class SendMessageUseCase {
  private readonly deps: SendMessageUseCaseDeps;
  private readonly flushIntervalMs: number;

  /**
   * 本次回合的宏上下文。
   *
   * 在 execute 开始时固定一次：用户输入与它的回复共用同一个时间戳，
   * 流式过程中 `{{time}}` 不会抖动；发送后即使切换角色也不影响本次回合。
   */
  private macroContext: MacroContext = {};

  /**
   * 「正在发送」互斥。
   *
   * 连续点发送、或在流式过程中触发重试，会交错 push 消息、并发覆盖
   * macroContext，两个请求的 flush 回调还会分别写回不同消息。
   */
  private isSending = false;

  constructor(
    deps: SendMessageUseCaseDeps,
    options: SendMessageUseCaseOptions = {},
  ) {
    this.deps = deps;
    // 与 StreamMessageAssembler 的默认值保持一致（一帧，约 16ms）
    this.flushIntervalMs = options.flushIntervalMs ?? 16;
  }

  async execute(content: string): Promise<void> {
    if (this.isSending) {
      return;
    }

    this.isSending = true;
    try {
      await this.executeInternal(content);
    } finally {
      this.isSending = false;
    }
  }

  /** 真正的发送逻辑；`execute` 只负责「进行中」互斥。 */
  private async executeInternal(content: string): Promise<void> {
    this.macroContext = {
      aiCharacter: this.deps.getCurrentCharacter(),
      userCharacter: this.deps.getSelectedUser(),
      now: new Date(),
    };

    this.deps.resetUsage();
    await this.deps.loadRegexRules();

    const processedContent = processChatContent(content, {
      scope: 'user',
      rules: this.deps.getRegexRules(),
      macroContext: this.macroContext,
    });

    const userMessage: Message = {
      id: createId(),
      type: 'user',
      content: processedContent,
      timestamp: Date.now(),
    };

    if (this.shouldAutoCompress([...this.deps.getMessages(), userMessage])) {
      const compressed = await this.runAutoCompression();
      if (!compressed) {
        return;
      }
    }

    const chatHistoryBeforeSend = [...this.deps.getRequestMessages()];
    this.deps.getMessages().push(userMessage);

    try {
      if (!this.deps.getPersistedConversationId()) {
        await this.deps.createNewConversation(userMessage);
      } else {
        await this.deps.saveConversation();
      }
    } catch (error) {
      // 尚未发给上游，保存失败时撤回本地插入，重试不会重复用户消息。
      const messages = this.deps.getMessages();
      const index = messages.findIndex(message => message === userMessage || message.id === userMessage.id);
      if (index !== -1) messages.splice(index, 1);
      throw error;
    }

    await this.deps.onMessageSend();

    const assistantMessageId = createId();
    const assistantMessage: Message = {
      id: assistantMessageId,
      type: 'assistant',
      content: '',
      timestamp: Date.now(),
    };
    this.deps.getMessages().push(assistantMessage);

    const requestMessages = this.deps.buildSystemMessages({
      aiCharacter: this.deps.getCurrentCharacter(),
      userCharacter: this.deps.getSelectedUser(),
      knowledgeBases: this.deps.getKnowledgeBases(),
      chatHistory: chatHistoryBeforeSend,
      userInstruction: processedContent,
      mergeMode: this.deps.getPromptMergeMode(),
      includeUserInstructionMessage: true,
      compressionSummary: this.deps.getCompressionSummary(),
    });

    let isCancelled = false;
    let hasCompleted = false;

    const streamAssembler = this.createStreamAssembler(assistantMessageId);

    const finalizeSend = async () => {
      streamAssembler.finalize();
      await this.deps.saveConversation();
    };

    try {
      await this.deps.sendStreamChatRequest(
        requestMessages,
        (chunk: string) => {
          streamAssembler.append(chunk);
        },
        async () => {
          await finalizeSend();
          // 先完成落库再置「已完成」：否则 finalizeSend 里的 saveConversation
          // 抛错时会被下面的 `if (hasCompleted) return` 静默吞掉，
          // 内容没落盘、用户也收不到任何提示
          hasCompleted = true;
          if (this.shouldAutoCompress(this.deps.getMessages())) {
            await this.runAutoCompression({ blockOnFailure: false });
          }
          this.deps.onSuccess('send');
        },
        async (error: string) => {
          isCancelled = error === REQUEST_CANCELLED_MESSAGE;
          await finalizeSend();

          const msg = this.findMessage(assistantMessageId);
          if (!msg) return;

          if (isCancelled) {
            if (!msg.content.trim()) {
              applyVariantContent(msg, '已停止生成');
              // 占位文案是在 finalizeSend 之后写的，必须再落一次盘，
              // 否则刷新后变成空回复
              await this.deps.saveConversation();
            }
            return;
          }

          applyVariantContent(msg, `错误: ${error}`);
          await this.deps.saveConversation();
          this.deps.onError('send', error);
        },
        (chunk) => this.appendReasoning(assistantMessageId, chunk),
      );
    } catch (err) {
      if (hasCompleted || isCancelled) {
        return;
      }

      streamAssembler.clear();
      const msg = this.findMessage(assistantMessageId);
      if (!msg) return;

      const errorMessage = err instanceof Error ? err.message : '发送失败';
      if (errorMessage === REQUEST_CANCELLED_MESSAGE) {
        if (!msg.content.trim()) {
          applyVariantContent(msg, '已停止生成');
        }
        await this.deps.saveConversation();
        return;
      }

      applyVariantContent(msg, `错误: ${errorMessage}`);
      await this.deps.saveConversation();
      this.deps.onError('send', errorMessage);
    }
  }

  /**
   * 重试最后一条 AI 回复：不新增消息，而是给同一条消息追加一个变体。
   *
   * 只允许最后一条：改历史回复会让它后面的对话建立在旧版本上，
   * 展示与上下文会不一致。
   */
  async regenerate(messageId: string): Promise<void> {
    if (this.isSending) {
      return;
    }

    this.isSending = true;
    try {
      await this.regenerateInternal(messageId);
    } finally {
      this.isSending = false;
    }
  }

  /** 真正的重试逻辑；`regenerate` 只负责「进行中」互斥。 */
  private async regenerateInternal(messageId: string): Promise<void> {
    const messages = this.deps.getMessages();
    const target = messages[messages.length - 1];

    if (!target || target.id !== messageId || target.type !== 'assistant') {
      return;
    }

    // 复现原回合的请求：历史停在最后一条用户消息之前，该用户指令单独传。
    const history = this.deps.getRequestMessages();
    const replyIndex = history.findIndex(message => message.id === messageId);
    const beforeReply = replyIndex === -1 ? history : history.slice(0, replyIndex);

    let lastUserIndex = -1;
    for (let index = beforeReply.length - 1; index >= 0; index -= 1) {
      if (beforeReply[index]?.type === 'user') {
        lastUserIndex = index;
        break;
      }
    }

    const userMessage = beforeReply[lastUserIndex];
    if (!userMessage) {
      return;
    }

    this.macroContext = {
      aiCharacter: this.deps.getCurrentCharacter(),
      userCharacter: this.deps.getSelectedUser(),
      now: new Date(),
    };

    this.deps.resetUsage();
    await this.deps.loadRegexRules();

    const previousVariantIndex = beginNewVariant(target);
    this.deps.onMessageSend();

    const requestMessages = this.deps.buildSystemMessages({
      aiCharacter: this.deps.getCurrentCharacter(),
      userCharacter: this.deps.getSelectedUser(),
      knowledgeBases: this.deps.getKnowledgeBases(),
      chatHistory: beforeReply.slice(0, lastUserIndex),
      userInstruction: userMessage.content,
      mergeMode: this.deps.getPromptMergeMode(),
      includeUserInstructionMessage: true,
      compressionSummary: this.deps.getCompressionSummary(),
    });

    const streamAssembler = this.createStreamAssembler(messageId);

    /** 一个字都没生成时把空槽位丢掉，不留下空回复（守卫在纯函数里）。 */
    const discardEmptyVariant = () => {
      const msg = this.findMessage(messageId);
      if (!msg) {
        return;
      }

      revertLastVariant(msg, previousVariantIndex);
    };

    let isCancelled = false;
    let hasCompleted = false;

    try {
      await this.deps.sendStreamChatRequest(
        requestMessages,
        (chunk: string) => {
          streamAssembler.append(chunk);
        },
        async () => {
          streamAssembler.finalize();
          discardEmptyVariant();
          await this.deps.saveConversation();
          // 先落库再置「已完成」，避免保存抛错被下面的 hasCompleted 判断吞掉
          hasCompleted = true;
          this.deps.onSuccess('retry');
        },
        async (error: string) => {
          isCancelled = error === REQUEST_CANCELLED_MESSAGE;
          streamAssembler.finalize();

          if (isCancelled) {
            discardEmptyVariant();
            await this.deps.saveConversation();
            return;
          }

          const msg = this.findMessage(messageId);
          if (msg) {
            applyVariantContent(msg, `错误: ${error}`);
          }
          await this.deps.saveConversation();
          this.deps.onError('send', error);
        },
        (chunk) => this.appendReasoning(messageId, chunk),
      );
    } catch (err) {
      if (hasCompleted || isCancelled) {
        return;
      }

      streamAssembler.clear();
      const errorMessage = err instanceof Error ? err.message : '重试失败';

      if (errorMessage === REQUEST_CANCELLED_MESSAGE) {
        discardEmptyVariant();
        await this.deps.saveConversation();
        return;
      }

      const msg = this.findMessage(messageId);
      if (msg) {
        applyVariantContent(msg, `错误: ${errorMessage}`);
      }
      await this.deps.saveConversation();
      this.deps.onError('send', errorMessage);
    }
  }

  /**
   * 流式装配器：把上游增量经 regex + 宏管线后写回目标消息。
   *
   * 写回统一走 `applyVariantContent`，因此带变体的消息会把内容同步到
   * 当前变体，而单条回复的消息行为与改写前完全一致。
   */
  private createStreamAssembler(assistantMessageId: string): StreamMessageAssembler {
    return new StreamMessageAssembler({
      flushIntervalMs: this.flushIntervalMs,
      getRegexRules: this.deps.getRegexRules,
      macroContext: this.macroContext,
      onFlush: (processedAssistantContent) => {
        const msg = this.findMessage(assistantMessageId);
        if (!msg) return;

        applyVariantContent(msg, processedAssistantContent);
        this.deps.onStreamFlush();
      },
    });
  }

  private shouldAutoCompress(messages?: Message[]): boolean {
    return this.deps.canUseConversationCompression()
      && this.deps.getCompressionMode() === 'auto'
      && this.deps.isCompressionThresholdReached(messages);
  }

  private async runAutoCompression(options: { blockOnFailure?: boolean } = {}): Promise<boolean> {
    const { blockOnFailure = true } = options;

    try {
      const compressed = await this.deps.compressConversation();
      if (compressed) {
        this.deps.onSuccess('compression');
      }
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '压缩失败';

      // 用户主动取消：不算失败，不报错，并中断本次发送。
      if (errorMessage === REQUEST_CANCELLED_MESSAGE) {
        return false;
      }

      this.deps.onError('compression', errorMessage);
      return !blockOnFailure;
    }
  }

  private appendReasoning(id: string, chunk: string): void {
    const message = this.findMessage(id);
    if (!message) return;
    message.reasoningContent = (message.reasoningContent ?? '') + chunk;
    if (message.reasoningVariants) {
      message.reasoningVariants[message.activeVariantIndex ?? 0] = message.reasoningContent;
    }
    this.deps.onStreamFlush();
  }

  private findMessage(id: string): Message | undefined {
    return this.deps.getMessages().find(message => message.id === id);
  }
}
