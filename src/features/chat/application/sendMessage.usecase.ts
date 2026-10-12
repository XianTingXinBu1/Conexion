import type { AICharacter, ChatMessage, KnowledgeBase, Message, RegexRule, UserCharacter } from '@/types';
import type { MacroContext, MergeMode } from '@/modules/system-prompt';
import { REQUEST_CANCELLED_MESSAGE } from '@/api/errors';
import { processChatContent } from './chatContentPipeline';
import { StreamMessageAssembler } from './streamMessageAssembler';
import { applyVariantContent, beginNewVariant, revertLastVariant } from './messageVariants';

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

  constructor(
    deps: SendMessageUseCaseDeps,
    options: SendMessageUseCaseOptions = {},
  ) {
    this.deps = deps;
    this.flushIntervalMs = options.flushIntervalMs ?? 50;
  }

  async execute(content: string): Promise<void> {
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
      id: Date.now().toString(),
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

    if (!this.deps.getPersistedConversationId()) {
      await this.deps.createNewConversation(userMessage);
    } else {
      await this.deps.saveConversation();
    }

    await this.deps.onMessageSend();

    const assistantMessageId = (Date.now() + 1).toString();
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
          hasCompleted = true;
          await finalizeSend();
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
            }
            return;
          }

          applyVariantContent(msg, `错误: ${error}`);
          this.deps.onError('send', error);
        },
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
          hasCompleted = true;
          streamAssembler.finalize();
          discardEmptyVariant();
          await this.deps.saveConversation();
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

  private findMessage(id: string): Message | undefined {
    return this.deps.getMessages().find(message => message.id === id);
  }
}
