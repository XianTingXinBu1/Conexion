import { ref, computed, type Ref } from 'vue';

/**
 * 拖拽排序 Composable
 *
 * 支持鼠标拖拽（HTML5 DnD）和触摸拖拽，适用于列表项的排序功能。
 *
 * 两条路径共用一套几何与让位逻辑：
 * - 触摸：拖动项跟手（translateY = 手指位移），span 内的项目让位
 * - 鼠标：浏览器负责拖影，拖动项本身不跟手（offset 为 0），只做让位与插入指示
 *
 * @template T - 列表项类型
 * @param items - 列表数据的响应式引用（必须是可写的 ref）
 * @param options - 配置选项
 * @returns 拖拽相关的状态和方法
 *
 * @example
 * ```ts
 * const items = ref<Item[]>([]);
 * const {
 *   draggedIndex,
 *   isDragging,
 *   itemOffsets,
 *   handleDragStart,
 *   handleDragOver,
 *   handleDrop,
 *   handleDragEnd,
 *   handleTouchStart,
 *   handleTouchMove,
 *   handleTouchEnd,
 *   handleTouchCancel,
 *   getItemStyle,
 *   insertBeforeIndex,
 * } = useDraggable(items, {
 *   itemHeight: 74,
 *   measureItemHeights: () => [...],
 *   onDragEnd: (newItems) => console.log('New order:', newItems),
 * });
 * ```
 */

type DragMode = 'touch' | 'mouse';

/** 指针进入滚动容器上下边缘多少像素内开始自动滚动 */
const AUTO_SCROLL_EDGE = 72;
/** 贴边时每帧最大滚动量（px） */
const AUTO_SCROLL_MAX_STEP = 16;

/**
 * 下一帧执行回调。
 * 单测（node 环境）没有 requestAnimationFrame，退化成 setTimeout。
 */
const hasAnimationFrame =
  typeof requestAnimationFrame === 'function' && typeof cancelAnimationFrame === 'function';

const scheduleFrame = (callback: () => void): number => {
  if (hasAnimationFrame) return requestAnimationFrame(callback);
  return setTimeout(callback, 16) as unknown as number;
};

const cancelFrame = (handle: number) => {
  if (hasAnimationFrame) cancelAnimationFrame(handle);
  else clearTimeout(handle);
};

export function useDraggable<T>(
  items: Ref<T[]>,
  options: {
    /** 单个列表项的高度（像素），仅在没有 measureItemHeights 时作为兜底 */
    itemHeight?: number;
    /**
     * 按真实布局测量每项的“节距”（本项顶到下一项顶的距离，含 gap）。
     * 拖拽开始时调用一次；列表项高度不固定时必须提供，否则落点会按固定高度推算而错位。
     */
    measureItemHeights?: () => number[];
    /**
     * 列表容器元素。用于拖动到上下边缘时自动滚动（沿祖先链找可滚动的那个容器）。
     * 不提供则不做自动滚动。
     */
    getListElement?: () => HTMLElement | null;
    /** 拖拽结束时的回调，传入新的列表顺序 */
    onDragEnd?: (newItems: T[]) => void;
  } = {}
) {
  const {
    itemHeight = 74,
    measureItemHeights,
    getListElement,
    onDragEnd,
  } = options;

  // 拖拽状态
  const draggedIndex = ref<number | null>(null);
  const isDragging = ref(false);
  const itemOffsets = ref<Map<number, number>>(new Map());

  // 本次手势开始时测量到的各槽位几何（节距），避免拖动中反复读布局
  let slotPitches: number[] = [];

  // 手势起点 / 当前位置：触摸用 touches[0].clientY，鼠标用 dragstart / dragover 的 clientY
  let gestureStartY = 0;
  let gestureCurrentY = 0;
  let dragMode: DragMode = 'touch';

  // 当前插入位置（独立存成 ref：gestureCurrentY 是普通变量，computed 读不到它的变化）
  const insertIndex = ref(-1);

  // 吸附动画的释放句柄
  let releaseHandle = 0;

  // 拖到上下边缘时的自动滚动
  let scrollContainer: HTMLElement | null = null;
  let scrollTopEdge = 0;
  let scrollBottomEdge = 0;
  // 手势开始时容器的可滚范围：拖动项自身会被 translate 拖出容器（撑大 scrollHeight），
  // 不钳制的话“溢出→又能滚→溢出更多”会正反馈无限滚下去
  let scrollMaxTop = 0;
  let scrollDelta = 0;
  let autoScrollHandle = 0;

  const resolvePitch = (index: number): number => {
    const measured = slotPitches[index];
    if (typeof measured === 'number' && Number.isFinite(measured) && measured > 0) {
      return measured;
    }
    return itemHeight;
  };

  const measureSlots = () => {
    const measured = measureItemHeights?.();
    slotPitches = Array.isArray(measured) && measured.length === items.value.length ? measured : [];
  };

  /** 从 from 槽位到 to 槽位之前的节距累计（to 不含） */
  const sumPitch = (from: number, to: number): number => {
    let total = 0;
    for (let index = from; index < to; index += 1) {
      total += resolvePitch(index);
    }
    return total;
  };

  /**
   * 从列表容器沿祖先链找可滚动的容器（页面内容区），供边缘自动滚动使用。
   * 拖拽开始时解析一次；容器不可滚（内容不够长）时返回 null，自动滚动自然关闭。
   */
  const resolveScrollContainer = (): HTMLElement | null => {
    const listElement = getListElement?.();
    let node = listElement?.parentElement ?? null;

    while (node) {
      const overflowY = typeof getComputedStyle === 'function' ? getComputedStyle(node).overflowY : '';
      // overflow: hidden 也算（拖拽期间页面会临时设成 hidden 防误滚，但内容仍可编程滚动）
      const scrollable = overflowY === 'auto' || overflowY === 'scroll'
        || overflowY === 'overlay' || overflowY === 'hidden';
      if (scrollable && node.scrollHeight > node.clientHeight) return node;
      node = node.parentElement;
    }

    return null;
  };

  /** 手势位移 + 自动滚动补偿：容器滚下去多少，卡片就要多往前走多少 */
  const resolveDeltaY = (): number => gestureCurrentY - gestureStartY + scrollDelta;

  const stopAutoScroll = () => {
    if (autoScrollHandle) {
      cancelFrame(autoScrollHandle);
      autoScrollHandle = 0;
    }
  };

  /** 指针是否停在滚动容器的上/下边缘带内 */
  const isPointerNearEdge = (): boolean => {
    if (!scrollContainer) return false;
    return (
      gestureCurrentY < scrollTopEdge + AUTO_SCROLL_EDGE
      || gestureCurrentY > scrollBottomEdge - AUTO_SCROLL_EDGE
    );
  };

  const runAutoScrollFrame = () => {
    autoScrollHandle = 0;

    const container = scrollContainer;
    if (!container || !isDragging.value) return;

    const distanceToTop = gestureCurrentY - scrollTopEdge;
    const distanceToBottom = scrollBottomEdge - gestureCurrentY;

    // 越贴边越快（指针移到容器外时按满速）
    const ratio = (distance: number) =>
      Math.min(1, Math.max(0, (AUTO_SCROLL_EDGE - distance) / AUTO_SCROLL_EDGE));

    let step = 0;
    if (distanceToTop < AUTO_SCROLL_EDGE) {
      step = -Math.ceil(AUTO_SCROLL_MAX_STEP * ratio(distanceToTop));
    } else if (distanceToBottom < AUTO_SCROLL_EDGE) {
      step = Math.ceil(AUTO_SCROLL_MAX_STEP * ratio(distanceToBottom));
    }

    if (step === 0) return;

    const before = container.scrollTop;
    const target = Math.max(0, Math.min(before + step, scrollMaxTop));
    container.scrollTop = target;
    const applied = container.scrollTop - before;

    if (applied !== 0) {
      scrollDelta += applied;
      // 这一帧已经在自动滚动循环里，不能再让 syncAutoScroll 排第二个循环（会指数级爆炸）
      updateProgress(false);
      autoScrollHandle = scheduleFrame(runAutoScrollFrame);
    }
    // 已经拖到两端（applied === 0）时停下，等下一次指针移动再重启
  };

  /** 每帧同步：在边缘带内就保持自动滚动，离开就停 */
  const syncAutoScroll = () => {
    if (isPointerNearEdge()) {
      if (!autoScrollHandle) autoScrollHandle = scheduleFrame(runAutoScrollFrame);
    } else {
      stopAutoScroll();
    }
  };

  const buildSlotCenters = (): number[] => {
    const centers: number[] = [];
    let offset = 0;

    for (let index = 0; index < items.value.length; index += 1) {
      const pitch = resolvePitch(index);
      centers.push(offset + pitch / 2);
      offset += pitch;
    }

    return centers;
  };

  /**
   * 根据指针位移推算落点：取“拖动项中心移动到的新位置”最近的槽位。
   * 按真实节距累加，所以列表项高度不一致时也不会跳格。
   */
  const resolveTargetIndex = (fromIndex: number, deltaY: number): number => {
    const centers = buildSlotCenters();
    if (centers.length === 0) return fromIndex;

    const movedCenter = (centers[fromIndex] ?? 0) + deltaY;
    let targetIndex = fromIndex;
    let minDistance = Number.POSITIVE_INFINITY;

    centers.forEach((center, index) => {
      const distance = Math.abs(center - movedCenter);
      if (distance < minDistance) {
        minDistance = distance;
        targetIndex = index;
      }
    });

    return Math.max(0, Math.min(targetIndex, items.value.length - 1));
  };

  /**
   * 计算让位偏移。
   *
   * 中间项统一让出**被拖项占用的那一段节距**（`resolvePitch(fromIndex)`），
   * 不能各让各的节距：卡片高度不一致时（描述长短不同、有无提示词内容），
   * 用自身节距会让高卡片的邻居整体错位，视觉上就是“卡片被挤飞”。
   *
   * @param draggedOffset 被拖项自身的位移（触摸跟手为手指位移，鼠标为 0）
   */
  const computeOffsets = (
    fromIndex: number,
    targetIndex: number,
    draggedOffset: number
  ): Map<number, number> => {
    const offsets = new Map<number, number>();
    const freedPitch = resolvePitch(fromIndex);

    for (let index = 0; index < items.value.length; index += 1) {
      if (index === fromIndex) {
        if (draggedOffset !== 0) offsets.set(index, draggedOffset);
      } else if (index > fromIndex && index <= targetIndex) {
        offsets.set(index, -freedPitch);
      } else if (index >= targetIndex && index < fromIndex) {
        offsets.set(index, freedPitch);
      }
    }

    return offsets;
  };

  /** 按当前指针位置刷新让位与插入点（自动滚动帧里不要再触发 syncAutoScroll）*/
  const updateProgress = (syncScroll = true) => {
    const fromIndex = draggedIndex.value;
    if (fromIndex === null || items.value.length === 0) return;

    const deltaY = resolveDeltaY();
    const targetIndex = resolveTargetIndex(fromIndex, deltaY);
    const draggedOffset = dragMode === 'touch' ? deltaY : 0;

    itemOffsets.value = computeOffsets(fromIndex, targetIndex, draggedOffset);
    insertIndex.value = targetIndex;

    if (syncScroll) syncAutoScroll();
  };

  const clearReleaseFrame = () => {
    if (releaseHandle) {
      cancelFrame(releaseHandle);
      releaseHandle = 0;
    }
  };

  const resetState = () => {
    clearReleaseFrame();
    stopAutoScroll();
    draggedIndex.value = null;
    isDragging.value = false;
    itemOffsets.value = new Map();
    insertIndex.value = -1;
    slotPitches = [];
    scrollContainer = null;
    scrollDelta = 0;
  };

  /** 手势开始：测量几何、记录起点、复位偏移 */
  const beginDrag = (index: number, clientY: number, mode: DragMode) => {
    if (index < 0 || index >= items.value.length) {
      console.warn('[useDraggable] Invalid drag start index:', index);
      return;
    }

    clearReleaseFrame();
    stopAutoScroll();
    measureSlots();

    // 自动滚动用的滚动容器与它的视口边界（拖拽期间容器位置不会变）
    scrollContainer = resolveScrollContainer();
    scrollDelta = 0;
    if (scrollContainer) {
      const rect = scrollContainer.getBoundingClientRect();
      scrollTopEdge = rect.top;
      scrollBottomEdge = rect.bottom;
      scrollMaxTop = Math.max(0, scrollContainer.scrollHeight - scrollContainer.clientHeight);
    }

    dragMode = mode;
    draggedIndex.value = index;
    isDragging.value = true;
    gestureStartY = clientY;
    gestureCurrentY = clientY;
    itemOffsets.value = new Map();
    insertIndex.value = index;
  };

  /**
   * 把被拖项从指针位置平滑吸附回它在新顺序里的槽位。
   *
   * 顺序变化与「相对新布局的初始位移」必须同帧生效，且该帧 `transition` 仍是 `none`
   * （`draggedIndex` 未清），否则元素会先跳到新布局位置再弹回来。
   * 下一帧再放开过渡、把偏移归零，卡片就滑进槽位。
   *
   * @param deltaY 松手时的指针位移（触摸为手指位移，鼠标为 0）
   */
  const settleAfterReorder = (fromIndex: number, targetIndex: number, deltaY: number) => {
    // 新槽位相对旧槽位的位移：向下取被越过项的节距和，向上取对称值
    const travel = targetIndex > fromIndex
      ? sumPitch(fromIndex + 1, targetIndex + 1)
      : -sumPitch(targetIndex, fromIndex);

    const followOffset = dragMode === 'touch' ? deltaY : 0;
    const restingOffset = followOffset - travel;

    if (restingOffset === 0) {
      resetState();
      return;
    }

    itemOffsets.value = new Map([[fromIndex, restingOffset]]);

    clearReleaseFrame();
    stopAutoScroll();
    releaseHandle = scheduleFrame(() => {
      releaseHandle = 0;
      draggedIndex.value = null;
      isDragging.value = false;
      itemOffsets.value = new Map();
      insertIndex.value = -1;
      slotPitches = [];
      scrollContainer = null;
      scrollDelta = 0;
    });
  };

  /** 落位：改顺序并回调，返回是否真的发生了移动 */
  const commitReorder = (fromIndex: number, targetIndex: number): boolean => {
    if (targetIndex === fromIndex) return false;

    if (targetIndex < 0 || targetIndex >= items.value.length) {
      console.warn('[useDraggable] Invalid drop target index:', targetIndex);
      return false;
    }

    try {
      const newItems = [...items.value];
      const [draggedItem] = newItems.splice(fromIndex, 1);

      if (!draggedItem) return false;

      newItems.splice(targetIndex, 0, draggedItem);
      items.value = newItems;
      onDragEnd?.(newItems);
      return true;
    } catch (error) {
      console.error('[useDraggable] Error during drop operation:', error);
      return false;
    }
  };

  /**
   * 处理鼠标拖拽开始
   * @param index - 被拖拽项的索引
   * @param event - dragstart 事件（提供指针起点，用于让位与插入指示）
   */
  const handleDragStart = (index: number, event?: DragEvent) => {
    beginDrag(index, event?.clientY ?? 0, 'mouse');
  };

  /**
   * 处理鼠标拖拽经过：用指针位置驱动让位动画与插入指示
   * @param event - dragover 事件
   */
  const handleDragOver = (event: DragEvent) => {
    event.preventDefault();

    if (!isDragging.value || draggedIndex.value === null) return;
    if (typeof event.clientY === 'number') gestureCurrentY = event.clientY;

    updateProgress();
  };

  /**
   * 处理鼠标拖拽放置。
   * 落点以插入指示（指针位置推算）为准：用「落在哪个元素上」的下标会和用户
   * 看到的指示线不一致（鼠标拖过多个元素时尤其明显）。
   * @param targetIndex - 放置目标的索引（没有指针信息时兜底）
   */
  const handleDrop = (targetIndex: number) => {
    const fromIndex = draggedIndex.value;
    if (fromIndex === null) return;

    const deltaY = resolveDeltaY();
    const resolvedTarget = insertIndex.value >= 0 ? insertIndex.value : targetIndex;

    commitReorder(fromIndex, resolvedTarget);
    settleAfterReorder(fromIndex, resolvedTarget, deltaY);
  };

  /**
   * 处理鼠标拖拽结束。
   * 正常路径已由 handleDrop 接管收尾（吸附动画进行中），这里只做兜底复位
   * ——拖到列表外松手时不会派发 drop。
   */
  const handleDragEnd = () => {
    if (releaseHandle) return;
    resetState();
  };

  /**
   * 处理触摸开始
   * @param index - 被拖拽项的索引
   * @param event - 触摸事件
   */
  const handleTouchStart = (index: number, event: TouchEvent) => {
    if (index < 0 || index >= items.value.length) {
      console.warn('[useDraggable] Invalid drag start index:', index);
      return;
    }

    event.preventDefault();
    const touch = event.touches[0];
    if (!touch) return;

    beginDrag(index, touch.clientY, 'touch');
  };

  /**
   * 处理触摸移动：拖动项跟手，其余项按被拖项的节距让位
   * @param event - 触摸事件
   */
  const handleTouchMove = (event: TouchEvent) => {
    if (!isDragging.value || draggedIndex.value === null) {
      return;
    }

    if (items.value.length === 0) {
      return;
    }

    event.preventDefault();
    const touch = event.touches[0];
    if (!touch) return;

    gestureCurrentY = touch.clientY;
    updateProgress();
  };

  /**
   * 处理触摸结束：落位改顺序，并把卡片吸附回槽位
   */
  const handleTouchEnd = () => {
    const fromIndex = draggedIndex.value;

    if (fromIndex === null) {
      isDragging.value = false;
      return;
    }

    if (items.value.length === 0) {
      resetState();
      return;
    }

    const deltaY = resolveDeltaY();
    const targetIndex = resolveTargetIndex(fromIndex, deltaY);

    commitReorder(fromIndex, targetIndex);
    settleAfterReorder(fromIndex, targetIndex, deltaY);
  };

  /**
   * 触摸被系统中断（例如浏览器接管手势）时收尾：不改顺序，只让卡片归位。
   * 不处理的话 isDragging / 偏移量会一直停在拖拽中的状态。
   */
  const handleTouchCancel = () => {
    const fromIndex = draggedIndex.value;

    if (fromIndex === null) {
      isDragging.value = false;
      return;
    }

    settleAfterReorder(fromIndex, fromIndex, resolveDeltaY());
  };

  /**
   * 获取列表项的样式。
   *
   * `transition` 常驻（只有被拖项是 `none`）：偏移归零时若把整条 inline style 摘掉，
   * 让位复位与松手吸附都会失去过渡，看起来就是“啪”地瞬移。
   *
   * @param index - 列表项索引
   * @returns 样式对象
   */
  const getItemStyle = (index: number) => {
    const offset = itemOffsets.value.get(index) ?? 0;
    const isDragged = index === draggedIndex.value;

    return {
      transform: offset === 0 ? undefined : `translateY(${offset}px)`,
      zIndex: isDragged ? 100 : 50,
      transition: isDragged ? 'none' : 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
    };
  };

  /**
   * 获取插入位置索引
   * @returns 插入位置的索引，如果不拖拽则返回 -1
   */
  const getInsertBeforeIndex = computed(() => {
    if (!isDragging.value || draggedIndex.value === null) {
      return -1;
    }

    return insertIndex.value;
  });

  return {
    // 状态
    draggedIndex,
    isDragging,
    itemOffsets,
    insertBeforeIndex: getInsertBeforeIndex,

    // 鼠标拖拽方法
    handleDragStart,
    handleDragOver,
    handleDrop,
    handleDragEnd,

    // 触摸拖拽方法
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleTouchCancel,

    // 样式和工具方法
    getItemStyle,
  };
}
