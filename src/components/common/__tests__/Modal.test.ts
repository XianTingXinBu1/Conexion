// @vitest-environment happy-dom
/**
 * Modal 的 Esc 处理
 *
 * 回归来源：keydown 监听器挂在 document 上、整个组件生命周期都在，
 * 但以前没判断弹窗是否真的打开，于是弹窗关闭后按 Esc 仍会触发关闭逻辑。
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/vue';
import { defineComponent, h, ref } from 'vue';
import Modal from '../Modal.vue';

function mountModal(initialShow: boolean) {
  const closed: number[] = [];
  const show = ref(initialShow);

  const Host = defineComponent({
    setup() {
      return () =>
        h(
          Modal,
          {
            show: show.value,
            guardBack: false,
            'onUpdate:show': (value: boolean) => {
              show.value = value;
              closed.push(value ? 1 : 0);
            },
          },
          { default: () => h('p', '内容') },
        );
    },
  });

  return { show, closed, ...render(Host) };
}

function pressEscape() {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
}

describe('Modal', () => {
  afterEach(() => {
    cleanup();
  });

  it('打开时按 Esc 会关闭', async () => {
    const { closed } = mountModal(true);

    pressEscape();

    expect(closed).toContain(0);
  });

  it('关闭后按 Esc 不再触发关闭', async () => {
    const { show, closed } = mountModal(true);

    show.value = false;
    await Promise.resolve();
    closed.length = 0;

    pressEscape();

    expect(closed).toHaveLength(0);
  });
});
