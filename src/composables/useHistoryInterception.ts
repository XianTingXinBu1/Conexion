import { ref } from 'vue';

export function useHistoryInterception(
  navigateBack: () => void,
  currentPage: () => string,
  pageHistory: { value: string[] },
  isNavigating: { value: boolean }
) {
  const showExitConfirm = ref(false);

  /**
   * 处理浏览器返回事件
   */
  const handlePopState = (event: PopStateEvent) => {
    // 如果正在程序化导航中，忽略事件
    if (isNavigating.value) return;

    // 如果有历史记录，执行返回
    if (pageHistory.value.length > 1) {
      isNavigating.value = true;
      // 移除当前页面
      pageHistory.value.pop();

      // 执行返回导航
      navigateBack();

      // 重置导航锁
      setTimeout(() => {
        isNavigating.value = false;
      }, 100);
    } else {
      // 没有历史记录，显示退出确认
      event.preventDefault();
      showExitConfirm.value = true;
    }
  };

  /**
   * 确认退出
   */
  const confirmExit = () => {
    showExitConfirm.value = false;
    // 清除拦截，允许正常退出
    window.removeEventListener('popstate', handlePopState);
    history.back();
  };

  /**
   * 取消退出
   */
  const cancelExit = () => {
    showExitConfirm.value = false;
    // 恢复当前页面状态
    history.pushState({ page: currentPage() }, '', `#${currentPage()}`);
  };

  /**
   * 初始化返回拦截
   */
  const setupHistoryInterception = () => {
    // 监听 popstate 事件
    window.addEventListener('popstate', handlePopState);
    // 初始化历史状态
    history.replaceState({ page: currentPage() }, '', `#${currentPage()}`);

    // 添加 overscroll 防止橡皮筋效果
    document.body.style.overscrollBehavior = 'none';
  };

  /**
   * 清理返回拦截
   */
  const cleanupHistoryInterception = () => {
    window.removeEventListener('popstate', handlePopState);
    // 恢复默认 overscroll 行为
    document.body.style.overscrollBehavior = '';
  };

  return {
    showExitConfirm,
    setupHistoryInterception,
    cleanupHistoryInterception,
    handlePopState,
    confirmExit,
    cancelExit,
  };
}