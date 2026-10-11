// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, nextTick, ref, type Ref } from 'vue';
import { cleanup, render } from '@testing-library/vue';
import { BACK_GUARD_STATE_KEY, useBackGuard } from '../useBackGuard';

/**
 * 挂一个最小覆盖层：open 为真时注册守卫，返回键触发 onBack 并关闭
 */
function mountOverlay(options: { open: Ref<boolean>; onBack: () => void }) {
  const component = defineComponent({
    setup() {
      useBackGuard({ isOpen: options.open, onBack: options.onBack });
      return () => h('div', { 'data-testid': 'overlay' });
    },
  });

  return render(component);
}

function hasSentinel(): boolean {
  const state = window.history.state as Record<string, unknown> | null;
  return Boolean(state && state[BACK_GUARD_STATE_KEY]);
}

function pressBack() {
  window.dispatchEvent(new PopStateEvent('popstate'));
}

describe('useBackGuard', () => {
  beforeEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('pushes a sentinel entry while the overlay is open', async () => {
    const open = ref(false);
    mountOverlay({ open, onBack: vi.fn() });

    expect(hasSentinel()).toBe(false);

    open.value = true;
    await nextTick();

    expect(hasSentinel()).toBe(true);
  });

  it('closes the top overlay on back instead of leaving the page', async () => {
    const open = ref(false);
    const onBack = vi.fn(() => {
      open.value = false;
    });

    mountOverlay({ open, onBack });

    open.value = true;
    await nextTick();

    pressBack();

    expect(onBack).toHaveBeenCalledTimes(1);

    await nextTick();
    expect(open.value).toBe(false);
  });

  it('keeps a sentinel so the guard stays armed when close is intercepted', async () => {
    const open = ref(false);
    // 模拟「未保存确认」拦下关闭：onBack 不关闭覆盖层
    const onBack = vi.fn();
    mountOverlay({ open, onBack });

    open.value = true;
    await nextTick();

    pressBack();
    await nextTick();

    expect(onBack).toHaveBeenCalledTimes(1);
    expect(open.value).toBe(true);
    // 还能再按一次，不会因为丢了一条历史就穿透到上一页
    expect(hasSentinel()).toBe(true);

    pressBack();
    expect(onBack).toHaveBeenCalledTimes(2);
  });

  it('only closes the topmost overlay when overlays are nested', async () => {
    const bottomOpen = ref(false);
    const topOpen = ref(false);
    const bottomBack = vi.fn(() => {
      bottomOpen.value = false;
    });
    const topBack = vi.fn(() => {
      topOpen.value = false;
    });

    mountOverlay({ open: bottomOpen, onBack: bottomBack });
    mountOverlay({ open: topOpen, onBack: topBack });

    bottomOpen.value = true;
    await nextTick();
    topOpen.value = true;
    await nextTick();

    pressBack();
    await nextTick();

    expect(topBack).toHaveBeenCalledTimes(1);
    expect(bottomBack).not.toHaveBeenCalled();
    expect(topOpen.value).toBe(false);
    expect(bottomOpen.value).toBe(true);

    pressBack();
    await nextTick();

    expect(bottomBack).toHaveBeenCalledTimes(1);
    expect(bottomOpen.value).toBe(false);
  });

  it('does not interfere when no overlay is open', async () => {
    const open = ref(false);
    const onBack = vi.fn();
    mountOverlay({ open, onBack });

    pressBack();
    await nextTick();

    expect(onBack).not.toHaveBeenCalled();
  });
});
