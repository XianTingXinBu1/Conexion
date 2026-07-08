import type { AICharacter, ChatMessage, KnowledgeBase, Message, RegexRule, UserCharacter } from '@/types';
import type { MergeMode } from '@/modules/system-prompt';
import { applyRules } from '@/utils/regexEngine';
import { StreamMessageAssembler } from './streamMessageAssembler';

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
  onSuccess: (kind: 'send' | 'compression') => void;
  onError: (kind: 'send' | 'compression', error: string) => void;
}

export interface SendMessageUseCaseOptions {
  flushIntervalMs?: number;
}

export class SendMessageUseCase {
  private readonly deps: SendMessageUseCaseDeps;
  private readonly flushIntervalMs: number;

  constructor(
    deps: SendMessageUseCaseDeps,
    options: SendMessageUseCaseOptions = {},
  ) {
    this.deps = deps;
    this.flushIntervalMs = options.flushIntervalMs ?? 50;
  }

  async execute(content: string): Promise<void> {
    this.deps.resetUsage();
    await this.deps.loadRegexRules();

    const processedContent = applyRules(content, 'user', 'after-macro', this.deps.getRegexRules());

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

    const streamAssembler = new StreamMessageAssembler({
      flushIntervalMs: this.flushIntervalMs,
      getRegexRules: this.deps.getRegexRules,
      onFlush: (processedAssistantContent) => {
        const msg = this.findMessage(assistantMessageId);
        if (!msg) return;

        msg.content = processedAssistantContent;
        this.deps.onStreamFlush();
      },
    });

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
          isCancelled = error === '请求已取消';
          await finalizeSend();

          const msg = this.findMessage(assistantMessageId);
          if (!msg) return;

          if (isCancelled) {
            if (!msg.content.trim()) {
              msg.content = '已停止生成';
            }
            return;
          }

          msg.content = `错误: ${error}`;
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
      if (errorMessage === '请求已取消') {
        if (!msg.content.trim()) {
          msg.content = '已停止生成';
        }
        await this.deps.saveConversation();
        return;
      }

      msg.content = `错误: ${errorMessage}`;
      await this.deps.saveConversation();
      this.deps.onError('send', errorMessage);
    }
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
      this.deps.onError('compression', errorMessage);
      return !blockOnFailure;
    }
  }

  private findMessage(id: string): Message | undefined {
    return this.deps.getMessages().find(message => message.id === id);
  }
}
