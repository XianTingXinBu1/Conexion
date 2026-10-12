// @vitest-environment happy-dom
import { render } from '@testing-library/vue';
import { describe, expect, it } from 'vitest';
import MessageItem from '../chat/MessageItem.vue';
import { beginNewVariant, revertLastVariant, setActiveVariant } from '@/features/chat/application/messageVariants';
import type { Message } from '@/types';

describe('native thinking', () => {
  it('renders reasoning separately and respects the API display switch', async () => {
    const { container, rerender } = render(MessageItem, { props: {
      message: { id: '1', type: 'assistant', content: '答案', reasoningContent: '分析过程', timestamp: 1 },
      index: 0, totalMessages: 1, displayCount: 1, theme: 'light', enableMarkdown: false,
      showWordCount: false, showMessageIndex: false, showThinking: true,
    } });
    expect(container.querySelector('details')?.textContent).toContain('分析过程');
    expect(container.querySelector('details')?.hasAttribute('open')).toBe(false);
    expect(container.querySelector('.message-content')?.textContent).toBe('答案');
    await rerender({ showThinking: false });
    expect(container.querySelector('details')).toBeNull();
    expect(container.querySelector('.message-content')?.textContent).toBe('答案');
  });

  it('switches reasoning with answer variants and restores it on empty retry', () => {
    const message: Message = { id: '1', type: 'assistant', content: '旧答案', reasoningContent: '旧思考', timestamp: 1 };
    const previous = beginNewVariant(message);
    expect(message.reasoningContent).toBe('');
    expect(revertLastVariant(message, previous)).toBe(true);
    expect(message.reasoningContent).toBe('旧思考');
    beginNewVariant(message);
    message.variants![1] = '新答案';
    message.reasoningVariants![1] = '新思考';
    setActiveVariant(message, 0);
    expect(message.reasoningContent).toBe('旧思考');
    setActiveVariant(message, 1);
    expect(message.reasoningContent).toBe('新思考');
  });
});
