import { ref, computed, type Ref } from 'vue';

/**
 * 拖拽排序 Composable
 *
 * 支持鼠标拖拽和触摸拖拽，适用于列表项的排序功能
 *
 * @template T - 列表项类型
 * @param items - 列表数据的响应式引用
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
 *   getItemStyle,
 *   getInsertBeforeIndex,
 * } = useDraggable(items, {
 *   itemHeight: 74,
 *   onDragEnd: (newItems) => console.log('New order:', newItems),
 * });
 * ```
 */
export function useDraggable<T>(
  items: Ref<T[]>,
  options: {
    /** 单个列表项的高度（像素），用于计算触摸拖拽 */
    itemHeight?: number;
    /** 拖拽结束时的回调，传入新的列表顺序 */
    onDragEnd?: (newItems: T[]) => void;
  } = {}
) {
  const {
    itemHeight = 74,
    onDragEnd,
  } = options;

  // 拖拽状态
  const draggedIndex = ref<number | null>(null);
  const isDragging = ref(false);

  // 触摸拖拽相关
  const touchStartY = ref<number>(0);
  const touchCurrentY = ref<number>(0);
  const itemOffsets = ref<Map<number, number>>(new Map());

  /**
   * 处理鼠标拖拽开始
   * @param index - 被拖拽项的索引
   */
  const handleDragStart = (index: number) => {
    // 边界检查
    if (index < 0 || index >= items.value.length) {
      console.warn('[useDraggable] Invalid drag start index:', index);
      return;
    }

    draggedIndex.value = index;
  };

  /**
   * 处理鼠标拖拽经过
   * @param event - 拖拽事件
   */
  const handleDragOver = (event: DragEvent) => {
    event.preventDefault();
  };

  /**
   * 处理鼠标拖拽放置
   * @param targetIndex - 放置目标的索引
   */
  const handleDrop = (targetIndex: number) => {
    // 边界检查
    if (draggedIndex.value === null) {
      return;
    }

    if (draggedIndex.value === targetIndex) {
      draggedIndex.value = null;
      return;
    }

    if (targetIndex < 0 || targetIndex >= items.value.length) {
      console.warn('[useDraggable] Invalid drop target index:', targetIndex);
      draggedIndex.value = null;
      return;
    }

    if (items.value.length === 0) {
      console.warn('[useDraggable] Cannot drop on empty list');
      draggedIndex.value = null;
      return;
    }

    try {
      const newItems = [...items.value];
      const [draggedItem] = newItems.splice(draggedIndex.value, 1);

      if (draggedItem) {
        newItems.splice(targetIndex, 0, draggedItem);
        items.value = newItems;
        onDragEnd?.(newItems);
      }
    } catch (error) {
      console.error('[useDraggable] Error during drop operation:', error);
    } finally {
      draggedIndex.value = null;
    }
  };

  /**
   * 处理鼠标拖拽结束
   */
  const handleDragEnd = () => {
    draggedIndex.value = null;
  };

  /**
   * 处理触摸开始
   * @param index - 被拖拽项的索引
   * @param event - 触摸事件
   */
  const handleTouchStart = (index: number, event: TouchEvent) => {
    // 边界检查
    if (index < 0 || index >= items.value.length) {
      console.warn('[useDraggable] Invalid touch start index:', index);
      return;
    }

    event.preventDefault();
    const touch = event.touches[0];
    if (!touch) return;

    isDragging.value = true;
    draggedIndex.value = index;
    touchStartY.value = touch.clientY;
    touchCurrentY.value = touch.clientY;
  };

  /**
   * 处理触摸移动
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

    touchCurrentY.value = touch.clientY;

    // 计算移动距离和目标位置
    const deltaY = touchCurrentY.value - touchStartY.value;
    const moveCount = Math.round(deltaY / itemHeight);
    let targetIndex = draggedIndex.value + moveCount;
    targetIndex = Math.max(0, Math.min(targetIndex, items.value.length - 1));

    // 计算每个项目的偏移量，用于视觉反馈
    const newOffsets = new Map<number, number>();
    for (let i = 0; i < items.value.length; i++) {
      if (i === draggedIndex.value) {
        newOffsets.set(i, deltaY);
      } else if (draggedIndex.value !== null) {
        if (i >= draggedIndex.value && i <= targetIndex) {
          newOffsets.set(i, -itemHeight);
        } else if (i >= targetIndex && i <= draggedIndex.value) {
          newOffsets.set(i, itemHeight);
        } else {
          newOffsets.set(i, 0);
        }
      }
    }

    itemOffsets.value = newOffsets;
  };

  /**
   * 处理触摸结束
   */
  const handleTouchEnd = () => {
    if (draggedIndex.value === null) {
      isDragging.value = false;
      return;
    }

    if (items.value.length === 0) {
      isDragging.value = false;
      draggedIndex.value = null;
      return;
    }

    try {
      const deltaY = (touchCurrentY.value ?? 0) - (touchStartY.value ?? 0);
      const moveCount = Math.round(deltaY / itemHeight);
      let targetIndex = draggedIndex.value + moveCount;
      targetIndex = Math.max(0, Math.min(targetIndex, items.value.length - 1));

      // 如果位置改变，更新列表
      if (targetIndex !== draggedIndex.value) {
        const newItems = [...items.value];
        const [draggedItem] = newItems.splice(draggedIndex.value, 1);

        if (draggedItem) {
          newItems.splice(targetIndex, 0, draggedItem);
          items.value = newItems;
          onDragEnd?.(newItems);
        }
      }
    } catch (error) {
      console.error('[useDraggable] Error during touch end operation:', error);
    } finally {
      // 重置状态
      isDragging.value = false;
      draggedIndex.value = null;
      itemOffsets.value.clear();
    }
  };

  /**
   * 获取列表项的样式
   * @param index - 列表项索引
   * @returns 样式对象
   */
  const getItemStyle = (index: number) => {
    const offset = itemOffsets.value.get(index) ?? 0;
    if (offset === 0) return {};

    const isDragged = index === draggedIndex.value;
    return {
      transform: `translateY(${offset}px)`,
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

    const deltaY = touchCurrentY.value - touchStartY.value;
    const moveCount = Math.round(deltaY / itemHeight);
    let targetIndex = draggedIndex.value + moveCount;
    targetIndex = Math.max(0, Math.min(targetIndex, items.value.length - 1));

    return targetIndex;
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

    // 样式和工具方法
    getItemStyle,
  };
}