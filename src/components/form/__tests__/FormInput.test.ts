// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/vue';
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
});
