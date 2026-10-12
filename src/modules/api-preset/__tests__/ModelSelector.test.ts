// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/vue';
import ModelSelector from '../components/ModelSelector.vue';

afterEach(cleanup);

describe('ModelSelector', () => {
  it('选择模型传递原始 ID，显示名称不覆盖 API 模型名', async () => {
    const { container, getByText, queryByText, emitted } = render(ModelSelector, {
      props: {
        models: [{ id: 'deepseek-flash', name: 'DeepSeek-V4.1-Flash' }],
        selectedModel: '',
        modelInput: '',
      },
    });
    const input = container.querySelector('input')!;
    await fireEvent.focus(input);
    expect(queryByText('DeepSeek-V4.1-Flash')).toBeNull();
    await fireEvent.click(getByText('deepseek-flash'));
    expect(emitted()['update:selectedModel']).toEqual([['deepseek-flash']]);
    expect(emitted()['update:modelInput']).toEqual([['deepseek-flash']]);
    expect(input.getAttribute('autocapitalize')).toBe('none');
  });

  it('手动输入保留模型 ID 大小写', async () => {
    const { container, emitted } = render(ModelSelector, {
      props: { models: [], selectedModel: '', modelInput: '' },
    });
    await fireEvent.update(container.querySelector('input')!, 'Provider/Custom-Model');
    expect(emitted()['update:selectedModel']).toEqual([['Provider/Custom-Model']]);
    expect(emitted()['update:modelInput']).toEqual([['Provider/Custom-Model']]);
  });
});
