// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/vue';
import ChatInput from '../chat/ChatInput.vue';

afterEach(cleanup);

describe('ChatInput', () => {
  it('protects composing Enter and Shift+Enter while ordinary Enter sends', async () => {
    const view = render(ChatInput, { props: { enterToSend: true } });
    const input = view.container.querySelector('textarea')!;
    await fireEvent.update(input, '你好');
    await fireEvent.compositionStart(input);
    await fireEvent.keyDown(input, { key: 'Enter' });
    await fireEvent.compositionEnd(input);
    await fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
    await fireEvent.keyDown(input, { key: 'Enter', keyCode: 229 });
    const shift = new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true, cancelable: true });
    input.dispatchEvent(shift);
    expect(shift.defaultPrevented).toBe(false);
    expect(view.emitted().send).toBeUndefined();
    await fireEvent.keyDown(input, { key: 'Enter' });
    expect(view.emitted().send).toHaveLength(1);
    expect(input.value).toBe('你好');
    ((view.emitted().send![0] as unknown[])[1] as () => void)();
    await fireEvent.focus(input);
    expect(input.value).toBe('');
  });

  it('allows typing during generation, without Enter sending or cancelling', async () => {
    const view = render(ChatInput, { props: { enterToSend: true, isRequestActive: true, isSending: true } });
    const input = view.container.querySelector('textarea')!;
    expect(input.disabled).toBe(false);
    await fireEvent.update(input, '下一条');
    await fireEvent.keyDown(input, { key: 'Enter' });
    expect(view.emitted().send).toBeUndefined();
    expect(view.emitted().cancel).toBeUndefined();
    await fireEvent.click(view.getByTitle('停止生成'));
    expect(view.emitted().cancel).toHaveLength(1);
  });

  it('retains failed input and does not erase a new draft on delayed acceptance', async () => {
    const view = render(ChatInput, { props: { enterToSend: true } });
    const input = view.container.querySelector('textarea')!;
    await fireEvent.update(input, '原文');
    await fireEvent.keyDown(input, { key: 'Enter' });
    expect(input.value).toBe('原文');
    await fireEvent.update(input, '新草稿');
    ((view.emitted().send![0] as unknown[])[1] as () => void)();
    await fireEvent.focus(input);
    expect(input.value).toBe('新草稿');
  });
});
