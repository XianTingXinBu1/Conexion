import type { RegexRule } from '@/types';
import type { MacroContext } from '@/modules/system-prompt';
import { processChatContent } from './chatContentPipeline';

export interface StreamMessageAssemblerOptions {
  flushIntervalMs?: number;
  getRegexRules: () => RegexRule[];
  /**
   * 宏上下文（角色与时间）。
   *
   * 由发送方在本次回合开始时取一次并固定：流式过程中 `{{time}}` 等宏
   * 不会因为跨过分钟边界而在同一个回复里抖出两个值。
   */
  macroContext: MacroContext;
  onFlush: (processedContent: string) => void;
}

export class StreamMessageAssembler {
  private readonly flushIntervalMs: number;
  private readonly getRegexRules: () => RegexRule[];
  private readonly macroContext: MacroContext;
  private readonly onFlush: (processedContent: string) => void;
  private streamBuffer = '';
  private rawContent = '';
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options: StreamMessageAssemblerOptions) {
    this.flushIntervalMs = options.flushIntervalMs ?? 50;
    this.getRegexRules = options.getRegexRules;
    this.macroContext = options.macroContext;
    this.onFlush = options.onFlush;
  }

  append(chunk: string): void {
    this.streamBuffer += chunk;
    this.scheduleFlush();
  }

  flush(): void {
    if (!this.streamBuffer) return;

    this.rawContent += this.streamBuffer;
    this.streamBuffer = '';

    this.onFlush(this.getProcessedContent());
  }

  finalize(): string {
    this.clearTimer();
    this.flush();
    return this.getProcessedContent();
  }

  clear(): void {
    this.clearTimer();
    this.streamBuffer = '';
  }

  private getProcessedContent(): string {
    return processChatContent(this.rawContent, {
      scope: 'assistant',
      rules: this.getRegexRules(),
      macroContext: this.macroContext,
    });
  }

  private scheduleFlush(): void {
    if (this.flushTimer) return;

    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.flush();
    }, this.flushIntervalMs);
  }

  private clearTimer(): void {
    if (!this.flushTimer) return;
    clearTimeout(this.flushTimer);
    this.flushTimer = null;
  }
}
