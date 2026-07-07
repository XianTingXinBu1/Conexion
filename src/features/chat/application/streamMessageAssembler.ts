import type { RegexRule } from '@/types';
import { applyRules } from '@/utils/regexEngine';

export interface StreamMessageAssemblerOptions {
  flushIntervalMs?: number;
  getRegexRules: () => RegexRule[];
  onFlush: (processedContent: string) => void;
}

export class StreamMessageAssembler {
  private readonly flushIntervalMs: number;
  private readonly getRegexRules: () => RegexRule[];
  private readonly onFlush: (processedContent: string) => void;
  private streamBuffer = '';
  private rawContent = '';
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options: StreamMessageAssemblerOptions) {
    this.flushIntervalMs = options.flushIntervalMs ?? 50;
    this.getRegexRules = options.getRegexRules;
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
    return applyRules(
      this.rawContent,
      'assistant',
      'after-macro',
      this.getRegexRules(),
    );
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
