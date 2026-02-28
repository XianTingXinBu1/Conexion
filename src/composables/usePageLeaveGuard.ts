import { ref, computed, type ComputedRef } from 'vue';

export interface PageLeaveGuardOptions {
  /** 是否启用离开确认 */
  enabled?: boolean | ComputedRef<boolean>;
  /** 自定义确认标题 */
  title?: string;
  /** 自定义确认消息 */
  message?: string;
  /** 自定义确认描述 */
  description?: string;
  /** 保存按钮文本 */
  saveText?: string;
  /** 放弃按钮文本 */
  discardText?: string;
  /** 取消按钮文本 */
  cancelText?: string;
}

/**
 * 页面离开守卫 Composable
 * 
 * 统一管理页面离开时的未保存更改确认逻辑
 * 适用于表单页面、编辑页面等需要确认离开的场景
 * 
 * @example
 * ```ts
 * const { 
 *   showLeaveConfirm,
 *   confirmDialogProps,
 *   checkBeforeLeave,
 *   handleSaveAndLeave,
 *   handleDiscardAndLeave,
 *   handleCancelLeave 
 * } = usePageLeaveGuard({
 *   enabled: computed(() => hasUnsavedChanges.value)
 * });
 * 
 * // 在返回按钮处理中使用
 * function handleBack() {
 *   if (checkBeforeLeave()) {
 *     emit('back');
 *   }
 * }
 * ```
 */
export function usePageLeaveGuard(options: PageLeaveGuardOptions = {}) {
  const {
    enabled = true,
    title = '未保存的更改',
    message = '您有未保存的更改',
    description = '是否保存更改后再离开？不保存将丢失所有修改。',
    saveText = '保存并离开',
    discardText = '不保存',
    cancelText = '取消',
  } = options;

  // 是否显示离开确认对话框
  const showLeaveConfirm = ref(false);
  
  // 待执行的离开回调
  const pendingLeaveCallback = ref<(() => void) | null>(null);

  // 确认对话框配置
  const confirmDialogProps = computed(() => ({
    show: showLeaveConfirm.value,
    title,
    message,
    description,
    type: 'warning' as const,
    confirmText: saveText,
    cancelText,
    showThirdButton: true,
    thirdButtonText: discardText,
    confirmDanger: false,
  }));

  /**
   * 检查是否可以离开页面
   * 如果有未保存的更改，显示确认对话框并返回 false
   * 如果没有未保存的更改或已确认，返回 true
   * 
   * @param onLeave - 确认离开后执行的回调
   * @returns 是否可以立即离开
   */
  function checkBeforeLeave(onLeave?: () => void): boolean {
    // 获取 enabled 的实际值
    const isEnabled = typeof enabled === 'object' && 'value' in enabled 
      ? (enabled as ComputedRef<boolean>).value 
      : enabled;
    
    // 如果未启用或未激活，直接允许离开
    if (!isEnabled) {
      onLeave?.();
      return true;
    }

    // 显示确认对话框
    showLeaveConfirm.value = true;
    pendingLeaveCallback.value = onLeave || null;
    return false;
  }

  /**
   * 处理保存并离开
   * @param onSave - 保存回调，返回 Promise 表示异步保存
   */
  async function handleSaveAndLeave(onSave?: () => void | Promise<void>): Promise<void> {
    showLeaveConfirm.value = false;
    
    try {
      await onSave?.();
      pendingLeaveCallback.value?.();
    } catch (error) {
      console.error('[usePageLeaveGuard] 保存失败:', error);
      throw error;
    }
  }

  /**
   * 处理放弃更改并离开
   */
  function handleDiscardAndLeave(): void {
    showLeaveConfirm.value = false;
    pendingLeaveCallback.value?.();
    pendingLeaveCallback.value = null;
  }

  /**
   * 处理取消离开
   */
  function handleCancelLeave(): void {
    showLeaveConfirm.value = false;
    pendingLeaveCallback.value = null;
  }

  /**
   * 强制离开（不检查）
   */
  function forceLeave(onLeave?: () => void): void {
    showLeaveConfirm.value = false;
    onLeave?.() ?? pendingLeaveCallback.value?.();
    pendingLeaveCallback.value = null;
  }

  return {
    // 状态
    showLeaveConfirm,
    confirmDialogProps,
    
    // 方法
    checkBeforeLeave,
    handleSaveAndLeave,
    handleDiscardAndLeave,
    handleCancelLeave,
    forceLeave,
  };
}


