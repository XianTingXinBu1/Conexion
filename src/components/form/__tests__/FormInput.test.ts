// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { fireEvent, render } from '@testing-library/vue';
import { defineComponent, h, ref } from 'vue';
import FormInput from '../FormInput.vue';

/**
 * 回归保护：模板 ref 绑在组件上拿到的是组件实例，
 * FormInput 必须 expose focus()，否则父组件调用 value.focus 会抛 TypeError
 * （PromptFormModal 的自动聚焦就踩过这个坑）。
 */
describe('FormInput', () => {
  it('通过模板 ref 暴露 focus()', async () => {
    let captured: { focus: () => void } | null = null;

    const Host = defineComponent({
      setup() {
        const value = ref('');
        return () =>
          h(FormInput, {
            ref: (instance: unknown) => {
              captured = instance as { focus: () => void };
            },
            modelValue: value.value,
            'onUpdate:modelValue': (next: unknown) => {
              value.value = String(next ?? '');
            },
          });
      },
    });

    const { container } = render(Host);

    expect(captured).not.toBeNull();
    expect(typeof captured!.focus).toBe('function');

    captured!.focus();

    expect(document.activeElement).toBe(container.querySelector('input'));
  });

  it('数字输入过程中不吞掉小数点，也不回灌中间态', async () => {
    // 回归：显示值完全派生自 props 时，`1.` 会被 parseFloat 成 1 并回填，
    // 小数点被吃掉、光标跳到末尾，小数参数根本打不出来。
    const seen: unknown[] = [];
    const Host = defineComponent({
      setup() {
        const value = ref<number | string | undefined>(undefined);
        return () =>
          h(FormInput, {
            type: 'number',
            modelValue: value.value as number | string | undefined,
            'onUpdate:modelValue': (next: unknown) => {
              seen.push(next);
              value.value = next as number | string | undefined;
            },
          });
      },
    });

    const { container } = render(Host);
    const input = container.querySelector('input');
    if (!input) throw new Error('输入框不存在');

    await fireEvent.update(input, '1.');
    expect(input.value).toBe('1.');

    await fireEvent.update(input, '1.5');
    expect(input.value).toBe('1.5');
    expect(seen[seen.length - 1]).toBe(1.5);
  });
});
