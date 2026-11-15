// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/vue';
import { defineComponent, h, nextTick, reactive } from 'vue';
import MarkdownRenderer from './components/MarkdownRenderer.vue';
import { useMarkdown } from './useMarkdown';

/**
 * 流式刷新策略的回归测试
 *
 * 这里守的是「合帧」而不是「防抖」：流式时内容每十来毫秒就变一次，
 * 防抖会让定时器永远等不到空闲，界面停在旧内容上不刷新（表现为一卡一卡）。
 * 合帧保证最新内容最多等一帧就上屏。
 */
describe('MarkdownRenderer streaming refresh', () => {
  let frames: FrameRequestCallback[];

  beforeEach(() => {
    frames = [];
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {});

    useMarkdown().reset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    cleanup();
  });

  /** 用外部 reactive 状态驱动组件，模拟流式内容不断被替换 */
  function mountStreaming(initialContent: string, initialStreaming = true) {
    const state = reactive({ content: initialContent, streaming: initialStreaming });

    const Host = defineComponent({
      setup: () => () => h(MarkdownRenderer, {
        content: state.content,
        streaming: state.streaming,
      }),
    });

    const wrapper = render(Host);

    return { state, wrapper };
  }

  it('coalesces updates into one frame and always shows the newest content', async () => {
    const { state, wrapper } = mountStreaming('第一句');

    // immediate 时已排了一帧
    expect(frames.length).toBe(1);

    // 帧还没到，又来了两片内容
    state.content = '第一句，第二句';
    await nextTick();
    state.content = '第一句，第二句，第三句';
    await nextTick();

    // 合帧：同一帧内不重复排队
    expect(frames.length).toBe(1);

    const pending = frames[0]!;
    frames.length = 0;
    pending(0);
    await nextTick();

    expect(wrapper.container.textContent).toContain('第三句');
  });

  it('keeps updating across consecutive frames instead of stalling', async () => {
    const { state, wrapper } = mountStreaming('零');

    const seen: string[] = [];
    for (let index = 1; index <= 5; index += 1) {
      state.content = `第${index}句`;
      await nextTick();

      const pending = frames.shift();
      expect(pending).toBeTypeOf('function');
      pending!(0);
      await nextTick();

      seen.push((wrapper.container.textContent ?? '').trim());
    }

    // 每一帧都必须把当时的最新内容画出来，而不是攒到最后
    expect(seen).toEqual(['第1句', '第2句', '第3句', '第4句', '第5句']);
  });

  it('renders immediately when streaming ends', async () => {
    const { state, wrapper } = mountStreaming('第一句');
    frames.length = 0;

    state.content = '完成的**内容**';
    state.streaming = false;
    await nextTick();

    // 定稿不等帧：标记被解析掉，说明走的是整篇 Markdown 渲染
    expect(wrapper.container.textContent).toContain('完成的内容');
    expect(wrapper.container.textContent).not.toContain('**');
    expect(frames.length).toBe(0);
  });
});
