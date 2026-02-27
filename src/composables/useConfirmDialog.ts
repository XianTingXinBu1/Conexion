import { ref } from 'vue';
import ConfirmDialog, { type ConfirmDialogProps } from '../components/ConfirmDialog.vue';

/**
 * 删除确认对话框 Composable
 * 用于封装删除操作的二次确认逻辑
 * 
 * @returns 确认对话框相关状态和方法
 */
export function useConfirmDialog() {
  // 删除目标ID
  const deleteTargetId = ref<string | null>(null);
  // 删除目标名称
  const deleteTargetName = ref('');

  // 确认对话框配置
  const confirmDialogProps = ref<ConfirmDialogProps>({
    show: false,
    title: '确认删除',
    message: '确定要删除',
    targetName: '',
    description: '此操作不可撤销，删除后将无法恢复。',
    type: 'delete',
    confirmText: '确认删除',
    cancelText: '取消',
    confirmDanger: true,
  });

  /**
   * 显示删除确认对话框
   * 
   * @param id 要删除的目标ID
   * @param name 要删除的目标名称
   * @param itemType 项目类型（如：角色、规则、预设等）
   */
  const showDeleteConfirm = (id: string, name: string, itemType: string = '') => {
    deleteTargetId.value = id;
    deleteTargetName.value = name;
    confirmDialogProps.value.message = itemType ? `确定要删除${itemType}` : '确定要删除';
    confirmDialogProps.value.targetName = name;
    confirmDialogProps.value.show = true;
  };

  /**
   * 获取当前删除目标的ID
   * 
   * @returns 删除目标ID
   */
  const getDeleteTargetId = (): string | null => {
    return deleteTargetId.value;
  };

  /**
   * 获取当前删除目标的名称
   * 
   * @returns 删除目标名称
   */
  const getDeleteTargetName = (): string => {
    return deleteTargetName.value;
  };

  /**
   * 确认删除
   * 调用此方法后，对话框会自动关闭
   * 
   * @returns 删除目标的ID
   */
  const confirmDelete = (): string | null => {
    const id = deleteTargetId.value;
    // 关闭对话框
    confirmDialogProps.value.show = false;
    deleteTargetId.value = null;
    deleteTargetName.value = '';
    return id;
  };

  /**
   * 取消删除
   */
  const cancelDelete = () => {
    confirmDialogProps.value.show = false;
    deleteTargetId.value = null;
    deleteTargetName.value = '';
  };

  /**
   * 重置对话框配置
   * 用于自定义对话框标题、描述等
   * 
   * @param props 部分对话框配置
   */
  const setDialogProps = (props: Partial<ConfirmDialogProps>) => {
    confirmDialogProps.value = {
      ...confirmDialogProps.value,
      ...props,
    };
  };

  return {
    // 状态
    deleteTargetId,
    deleteTargetName,
    confirmDialogProps,

    // 方法
    showDeleteConfirm,
    getDeleteTargetId,
    getDeleteTargetName,
    confirmDelete,
    cancelDelete,
    setDialogProps,

    // 组件（用于模板中使用）
    ConfirmDialog,
  };
}

export type { ConfirmDialogProps };