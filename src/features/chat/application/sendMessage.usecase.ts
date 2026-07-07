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
  isCompressionThresholdReached: () => boolean;
  compressConversation: () => Promise<boolean>;
  getCompressionSummary: () => string;
  getPersistedConversationId: () => string | undefined;
  resetUsage: () => void;
  loadRegexRules: () => Promise<void>;
  createNewConversation: (firstMessage: Message) => Promise<unknown>;
  saveConversation: () => Promise<void>;
  onStreamFlush: () => void;
  onMessageSend: () => void;
  sendStreamChatRequest: (
    messages: Message[],
    onChunk: (chunk: string) => void,
    onComplete: () => void,
    onError: (error: string) => void,
    systemPrompt?: string,
    systemMessages?: ChatMessage[]
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

    if (
      this.deps.canUseConversationCompression()
      && this.deps.getCompressionMode() === 'auto'
      && this.deps.isCompressionThresholdReached()
    ) {
      try {
        await this.deps.compressConversation();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '压缩失败';
        this.deps.onError('compression', errorMessage);
        return;
      }
    }

    const chatHistoryBeforeSend = [...this.deps.getRequestMessages()];
    const messagesForRequest = [...chatHistoryBeforeSend, userMessage];
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

    const systemMessages = this.deps.buildSystemMessages({
      aiCharacter: this.deps.getCurrentCharacter(),
      userCharacter: this.deps.getSelectedUser(),
      knowledgeBases: this.deps.getKnowledgeBases(),
      chatHistory: chatHistoryBeforeSend,
      userInstruction: processedContent,
      mergeMode: this.deps.getPromptMergeMode(),
      includeUserInstructionMessage: false,
      compressionSummary: this.deps.getCompressionSummary(),
    });

    let isCancelled = false;
    let hasCompleted = false;

    const streamAssembler = new StreamMessageAssembler({
      flushIntervalMs: this.flushIntervalMs,
      getRegexRules: this.deps.getRegexRules,
      onFlush: (processedContent) => {
        const msg = this.findMessage(assistantMessageId);
        if (!msg) return;

        msg.content = processedContent;
        this.deps.onStreamFlush();
      },
    });

    const finalizeSend = async () => {
      streamAssembler.finalize();
      await this.deps.saveConversation();
    };

    try {
      await this.deps.sendStreamChatRequest(
        messagesForRequest,
        (chunk: string) => {
          streamAssembler.append(chunk);
        },
        async () => {
          hasCompleted = true;
          await finalizeSend();
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
        undefined,
        systemMessages.length > 0 ? systemMessages : undefined,
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

  private findMessage(id: string): Message | undefined {
    return this.deps.getMessages().find(message => message.id === id);
  }
}
