import { ref } from 'vue';

/**
 * 触摸处理器返回的接口
 */
export interface TouchHandlerResult {
  onTouchStart: (id: string, event: TouchEvent) => void;
  onTouchMove: (event: TouchEvent) => void;
  onTouchEnd: () => void;
}

/**
 * 使用触摸处理器 composable
 * 提供统一的长按处理逻辑，支持移动端触摸事件
 *
 * @param callback - 长按触发时的回调函数，接收 id 参数
 * @param delay - 长按延迟时间（毫秒），默认 800ms
 * @param moveThreshold - 触摸移动阈值（像素），超过此值取消长按，默认 10px
 * @returns 触摸事件处理器对象
 *
 * @example
 * ```ts
 * const { onTouchStart, onTouchMove, onTouchEnd } = useTouchHandler(
 *   (id) => {
 *     console.log('长按触发:', id);
 *   },
 *   800, // 800ms 延迟
 *   10   // 10px 移动阈值
 * );
 * ```
 */
export function useTouchHandler(
  callback: (id: string) => void,
  delay: number = 800,
  moveThreshold: number = 10
): TouchHandlerResult {
  const touchStartTimer = ref<number | null>(null);
  const touchStartX = ref(0);
  const touchStartY = ref(0);

  /**
   * 处理触摸开始事件
   * 记录触摸位置并启动长按定时器
   */
  const onTouchStart = (id: string, event: TouchEvent) => {
    const touch = event.touches[0];
    if (!touch) return;

    touchStartX.value = touch.clientX;
    touchStartY.value = touch.clientY;

    // 设置长按定时器
    touchStartTimer.value = window.setTimeout(() => {
      callback(id);
      touchStartTimer.value = null;
    }, delay);
  };

  /**
   * 处理触摸移动事件
   * 如果移动距离超过阈值，取消长按
   */
  const onTouchMove = (event: TouchEvent) => {
    const touch = event.touches[0];
    if (!touch) return;

    const deltaX = Math.abs(touch.clientX - touchStartX.value);
    const deltaY = Math.abs(touch.clientY - touchStartY.value);

    if (deltaX > moveThreshold || deltaY > moveThreshold) {
      if (touchStartTimer.value !== null) {
        clearTimeout(touchStartTimer.value);
        touchStartTimer.value = null;
      }
    }
  };

  /**
   * 处理触摸结束事件
   * 清除长按定时器
   */
  const onTouchEnd = () => {
    if (touchStartTimer.value !== null) {
      clearTimeout(touchStartTimer.value);
      touchStartTimer.value = null;
    }
  };

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
  };
}