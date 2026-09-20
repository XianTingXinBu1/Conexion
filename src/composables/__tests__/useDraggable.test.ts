import { describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import { useDraggable } from '../useDraggable';

const touchEvent = (clientY: number) =>
  ({ touches: [{ clientY, clientX: 0 }], preventDefault: () => {} }) as unknown as TouchEvent;

function setup(pitches: number[], count = pitches.length) {
  const items = ref(Array.from({ length: count }, (_, index) => `item-${index}`));
  const onDragEnd = vi.fn();
  const draggable = useDraggable(items, {
    itemHeight: 74,
    measureItemHeights: () => [...pitches],
    onDragEnd,
  });

  return { items, onDragEnd, draggable };
}

describe('useDraggable 触摸拖拽', () => {
  it('按真实节距推算落点，而不是固定高度', () => {
    // 节距 100/300/100/100：槽位中心 = 50 / 250 / 550 / 650
    const { items, onDragEnd, draggable } = setup([100, 300, 100, 100]);

    draggable.handleTouchStart(0, touchEvent(0));
    draggable.handleTouchMove(touchEvent(150));
    draggable.handleTouchEnd();

    // 拖动项中心 50 + 150 = 200，最近槽位是 #2(中心 250)
    expect([...items.value]).toEqual(['item-1', 'item-0', 'item-2', 'item-3']);
    expect(onDragEnd).toHaveBeenCalledWith(items.value);
  });

  it('固定高度兜底时行为与旧实现一致', () => {
    const { items, draggable } = setup([74, 74, 74, 74]);

    draggable.handleTouchStart(0, touchEvent(0));
    draggable.handleTouchMove(touchEvent(148));
    draggable.handleTouchEnd();

    expect([...items.value]).toEqual(['item-1', 'item-2', 'item-0', 'item-3']);
  });

  it('位移不足半格时不换位', () => {
    const { items, onDragEnd, draggable } = setup([100, 100, 100]);

    draggable.handleTouchStart(0, touchEvent(0));
    draggable.handleTouchMove(touchEvent(30));
    draggable.handleTouchEnd();

    expect([...items.value]).toEqual(['item-0', 'item-1', 'item-2']);
    expect(onDragEnd).not.toHaveBeenCalled();
  });

  it('touchcancel 复位状态，不改变顺序', () => {
    const { items, onDragEnd, draggable } = setup([100, 100, 100]);

    draggable.handleTouchStart(0, touchEvent(0));
    draggable.handleTouchMove(touchEvent(120));
    draggable.handleTouchCancel();

    expect([...items.value]).toEqual(['item-0', 'item-1', 'item-2']);
    expect(onDragEnd).not.toHaveBeenCalled();
    expect(draggable.isDragging.value).toBe(false);
    expect(draggable.draggedIndex.value).toBeNull();
    expect(draggable.itemOffsets.value.size).toBe(0);
  });
});
