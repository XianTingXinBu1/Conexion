import { describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import { useDraggable } from '../useDraggable';

const touchEvent = (clientY: number) =>
  ({ touches: [{ clientY, clientX: 0 }], preventDefault: () => {} }) as unknown as TouchEvent;

const dragEvent = (clientY: number) =>
  ({ clientY, clientX: 0, preventDefault: () => {} }) as unknown as DragEvent;

/** 等一帧：composable 用 rAF（node 环境退化为 setTimeout）释放吸附位移 */
const nextFrame = () => new Promise((resolve) => setTimeout(resolve, 40));

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

describe('useDraggable 落点计算', () => {
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
});

describe('useDraggable 让位动画', () => {
  it('中间项让出被拖项占用的节距，而不是各自的高度', () => {
    // #1 是 220px 的高卡片：让位量必须是 #0 的节距(84)，用 230 会把邻居挤飞
    const { draggable } = setup([84, 230, 97, 96, 84, 84]);

    draggable.handleTouchStart(0, touchEvent(0));
    draggable.handleTouchMove(touchEvent(150));

    expect(draggable.itemOffsets.value.get(0)).toBe(150);
    expect(draggable.itemOffsets.value.get(1)).toBe(-84);
    expect(draggable.insertBeforeIndex.value).toBe(1);
  });

  it('跨多格时被越过的项让位量一致', () => {
    const { draggable } = setup([84, 230, 97, 96, 84, 84]);

    draggable.handleTouchStart(0, touchEvent(0));
    draggable.handleTouchMove(touchEvent(400));

    expect(draggable.insertBeforeIndex.value).toBe(3);
    expect(draggable.itemOffsets.value.get(1)).toBe(-84);
    expect(draggable.itemOffsets.value.get(2)).toBe(-84);
    expect(draggable.itemOffsets.value.get(3)).toBe(-84);
  });

  it('向上拖时让位方向相反、位移同为被拖项节距', () => {
    const { draggable } = setup([84, 230, 97, 96, 84, 84]);

    draggable.handleTouchStart(3, touchEvent(0));
    draggable.handleTouchMove(touchEvent(-200));

    // #3 节距 96，向上越过 #1、#2 → 二者下移 96
    expect(draggable.itemOffsets.value.get(3)).toBe(-200);
    expect(draggable.itemOffsets.value.get(1)).toBe(96);
    expect(draggable.itemOffsets.value.get(2)).toBe(96);
    expect(draggable.insertBeforeIndex.value).toBe(1);
  });

  it('拖动过程中插入位置随位移更新', () => {
    const { draggable } = setup([100, 100, 100, 100]);

    draggable.handleTouchStart(0, touchEvent(0));
    expect(draggable.insertBeforeIndex.value).toBe(0);

    draggable.handleTouchMove(touchEvent(120));
    expect(draggable.insertBeforeIndex.value).toBe(1);

    draggable.handleTouchMove(touchEvent(300));
    expect(draggable.insertBeforeIndex.value).toBe(3);
  });

  it('让位项归零时仍保留过渡（inline style 常驻）', () => {
    const { draggable } = setup([84, 84, 84]);

    draggable.handleTouchStart(0, touchEvent(0));
    draggable.handleTouchMove(touchEvent(120));
    expect(draggable.getItemStyle(1).transition).toBe('transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)');

    // 回拖到起点：偏移归零，但 transition 不能被摘掉
    draggable.handleTouchMove(touchEvent(10));
    expect(draggable.itemOffsets.value.get(1) ?? 0).toBe(0);
    expect(draggable.getItemStyle(1).transition).toBe('transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)');
    expect(draggable.getItemStyle(1).transform).toBeUndefined();
  });
});

describe('useDraggable 松手吸附', () => {
  it('落位时先保留相对新布局的位移，下一帧再归零', async () => {
    const { items, draggable } = setup([84, 230, 97, 96, 84, 84]);

    draggable.handleTouchStart(0, touchEvent(0));
    draggable.handleTouchMove(touchEvent(150));
    draggable.handleTouchEnd();

    // 新槽位相对旧位置位移 230（第二项的高度 + gap），松手时手指位移 150
    expect([...items.value]).toEqual(['item-1', 'item-0', 'item-2', 'item-3', 'item-4', 'item-5']);
    expect(draggable.itemOffsets.value.get(0)).toBe(150 - 230);
    expect(draggable.draggedIndex.value).toBe(0);

    await nextFrame();

    expect(draggable.itemOffsets.value.size).toBe(0);
    expect(draggable.draggedIndex.value).toBeNull();
    expect(draggable.isDragging.value).toBe(false);
  });

  it('位移恰好等于槽位间距时不需要吸附动画', () => {
    const { items, draggable } = setup([84, 84, 84]);

    draggable.handleTouchStart(0, touchEvent(0));
    draggable.handleTouchMove(touchEvent(84));
    draggable.handleTouchEnd();

    expect([...items.value]).toEqual(['item-1', 'item-0', 'item-2']);
    expect(draggable.itemOffsets.value.size).toBe(0);
    expect(draggable.draggedIndex.value).toBeNull();
  });

  it('touchcancel 复位状态，不改顺序，只让卡片归位', async () => {
    const { items, onDragEnd, draggable } = setup([100, 100, 100]);

    draggable.handleTouchStart(0, touchEvent(0));
    draggable.handleTouchMove(touchEvent(120));
    draggable.handleTouchCancel();

    expect([...items.value]).toEqual(['item-0', 'item-1', 'item-2']);
    expect(onDragEnd).not.toHaveBeenCalled();

    await nextFrame();

    expect(draggable.isDragging.value).toBe(false);
    expect(draggable.draggedIndex.value).toBeNull();
    expect(draggable.itemOffsets.value.size).toBe(0);
  });
});

describe('useDraggable 鼠标拖拽', () => {
  it('dragstart / dragover 驱动让位与插入指示，拖动项本身不跟手', () => {
    const { draggable } = setup([84, 230, 97, 96, 84, 84]);

    draggable.handleDragStart(0, dragEvent(100));
    draggable.handleDragOver(dragEvent(250));

    expect(draggable.isDragging.value).toBe(true);
    expect(draggable.insertBeforeIndex.value).toBe(1);
    expect(draggable.itemOffsets.value.get(1)).toBe(-84);
    // 鼠标路径由浏览器拖影跟随，元素不移动
    expect(draggable.itemOffsets.value.get(0)).toBeUndefined();
  });

  it('drop 落位并改顺序，dragend 不打断吸附', async () => {
    const { items, onDragEnd, draggable } = setup([84, 84, 84]);

    draggable.handleDragStart(0, dragEvent(100));
    draggable.handleDragOver(dragEvent(100 + 100));
    draggable.handleDrop(1);

    expect([...items.value]).toEqual(['item-1', 'item-0', 'item-2']);
    expect(onDragEnd).toHaveBeenCalledWith(items.value);

    draggable.handleDragEnd();
    await nextFrame();

    expect(draggable.draggedIndex.value).toBeNull();
    expect(draggable.isDragging.value).toBe(false);
    expect(draggable.itemOffsets.value.size).toBe(0);
  });

  it('drop 以插入指示为准，而不是落在哪个元素上', () => {
    const { items, draggable } = setup([84, 84, 84, 84]);

    draggable.handleDragStart(0, dragEvent(100));
    draggable.handleDragOver(dragEvent(100 + 250));
    expect(draggable.insertBeforeIndex.value).toBe(3);

    // 元素下标与指针推算的落点不一致时，以指示为准
    draggable.handleDrop(1);

    expect([...items.value]).toEqual(['item-1', 'item-2', 'item-3', 'item-0']);
  });

  it('拖到列表外松手（只发 dragend）时复位状态', () => {
    const { items, draggable } = setup([84, 84, 84]);

    draggable.handleDragStart(0, dragEvent(100));
    draggable.handleDragOver(dragEvent(300));
    draggable.handleDragEnd();

    expect([...items.value]).toEqual(['item-0', 'item-1', 'item-2']);
    expect(draggable.draggedIndex.value).toBeNull();
    expect(draggable.isDragging.value).toBe(false);
    expect(draggable.itemOffsets.value.size).toBe(0);
  });
});
