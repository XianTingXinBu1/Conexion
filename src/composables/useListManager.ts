import { ref, computed, type Ref } from 'vue';

export interface ListItem {
  id: string;
  name: string;
  [key: string]: any;
}

export interface ListManagerOptions<T extends ListItem> {
  /** 初始数据 */
  initialData?: T[];
  /** 存储键（用于本地存储） */
  storageKey?: string;
  /** 默认数据（当存储为空时使用） */
  defaults?: T[];
  /** 最小保留数量 */
  minCount?: number;
  /** 是否启用本地存储 */
  persist?: boolean;
}

export interface ListManagerReturn<T extends ListItem> {
  // 状态
  items: Ref<T[]>;
  selectedId: Ref<string | null>;
  selectedItem: Ref<T | null>;
  showCreateDialog: Ref<boolean>;
  showRenameDialog: Ref<boolean>;
  newItemName: Ref<string>;
  renameItemName: Ref<string>;
  renameItemId: Ref<string | null>;
  canCreate: Ref<boolean>;
  canRename: Ref<boolean>;
  
  // 方法
  loadItems: (data: T[]) => void;
  selectItem: (id: string) => void;
  createItem: (data: Omit<T, 'id' | 'createdAt' | 'updatedAt'> & Partial<Pick<T, 'id' | 'createdAt' | 'updatedAt'>>) => T | null;
  updateItem: (id: string, data: Partial<T>) => boolean;
  deleteItem: (id: string) => boolean;
  openCreateDialog: () => void;
  closeCreateDialog: () => void;
  openRenameDialog: (id: string) => void;
  closeRenameDialog: () => void;
  confirmRename: () => boolean;
  getItemById: (id: string) => T | null;
  setItems: (items: T[]) => void;
}

/**
 * 列表管理 Composable
 * 
 * 提供通用的列表CRUD操作：创建、读取、更新、删除、选择
 * 适用于角色管理、预设管理、知识库管理等场景
 * 
 * @example
 * ```ts
 * const {
 *   items: characters,
 *   selectedId,
 *   selectedItem,
 *   createItem: createCharacter,
 *   deleteItem: deleteCharacter,
 *   openCreateDialog,
 *   showCreateDialog,
 *   newItemName,
 *   canCreate,
 * } = useListManager<Character>({
 *   storageKey: 'myapp_characters',
 *   defaults: DEFAULT_CHARACTERS,
 *   minCount: 1,
 * });
 * ```
 */
export function useListManager<T extends ListItem>(
  options: ListManagerOptions<T> = {}
): ListManagerReturn<T> {
  const {
    initialData = [],
    minCount = 0,
  } = options;

  // 列表数据
  const items = ref<T[]>([...initialData]) as Ref<T[]>;
  
  // 选中的项目ID
  const selectedId = ref<string | null>(null);
  
  // 对话框状态
  const showCreateDialog = ref(false);
  const showRenameDialog = ref(false);
  
  // 表单数据
  const newItemName = ref('');
  const renameItemId = ref<string | null>(null);
  const renameItemName = ref('');

  // 计算属性
  const selectedItem = computed(() => 
    items.value.find(item => item.id === selectedId.value) || null
  );
  
  const canCreate = computed(() => newItemName.value.trim().length > 0);
  const canRename = computed(() => renameItemName.value.trim().length > 0);

  // 加载数据
  function loadItems(data: T[]) {
    items.value = [...data];
    
    // 如果没有选中项或选中项不存在，默认选中第一个
    if (!selectedId.value || !items.value.find(item => item.id === selectedId.value)) {
      if (items.value.length > 0) {
        selectedId.value = items.value[0]!.id;
      }
    }
  }

  // 选择项目
  function selectItem(id: string) {
    selectedId.value = id;
  }

  // 创建项目
  function createItem(
    data: Omit<T, 'id' | 'createdAt' | 'updatedAt'> & Partial<Pick<T, 'id' | 'createdAt' | 'updatedAt'>>
  ): T | null {
    if (!newItemName.value.trim()) return null;

    const now = Date.now();
    const newItem = {
      ...data,
      id: data.id || now.toString(),
      name: newItemName.value.trim(),
      createdAt: data.createdAt || now,
      updatedAt: data.updatedAt || now,
    } as unknown as T;

    items.value.push(newItem);
    selectedId.value = newItem.id;
    newItemName.value = '';
    showCreateDialog.value = false;

    return newItem;
  }

  // 更新项目
  function updateItem(id: string, data: Partial<T>): boolean {
    const index = items.value.findIndex(item => item.id === id);
    if (index === -1) return false;

    items.value[index] = {
      ...items.value[index]!,
      ...data,
      updatedAt: Date.now(),
    };
    return true;
  }

  // 删除项目
  function deleteItem(id: string): boolean {
    // 检查最小数量限制
    if (minCount > 0 && items.value.length <= minCount) {
      console.warn(`[useListManager] 无法删除：至少需要保留 ${minCount} 个项目`);
      return false;
    }

    const index = items.value.findIndex(item => item.id === id);
    if (index === -1) return false;

    items.value.splice(index, 1);

    // 如果删除的是当前选中的项目，重新选择
    if (selectedId.value === id) {
      if (items.value.length > 0) {
        selectedId.value = items.value[0]!.id;
      } else {
        selectedId.value = null;
      }
    }

    return true;
  }

  // 打开创建对话框
  function openCreateDialog() {
    newItemName.value = '';
    showCreateDialog.value = true;
  }

  // 关闭创建对话框
  function closeCreateDialog() {
    newItemName.value = '';
    showCreateDialog.value = false;
  }

  // 打开重命名对话框
  function openRenameDialog(id: string) {
    const item = items.value.find(item => item.id === id);
    if (item) {
      renameItemId.value = id;
      renameItemName.value = item.name;
      showRenameDialog.value = true;
    }
  }

  // 关闭重命名对话框
  function closeRenameDialog() {
    renameItemId.value = null;
    renameItemName.value = '';
    showRenameDialog.value = false;
  }

  // 确认重命名
  function confirmRename(): boolean {
    if (!renameItemName.value.trim() || !renameItemId.value) return false;

    const success = updateItem(renameItemId.value, {
      name: renameItemName.value.trim(),
    } as Partial<T>);

    if (success) {
      closeRenameDialog();
    }

    return success;
  }

  // 根据ID获取项目
  function getItemById(id: string): T | null {
    return items.value.find(item => item.id === id) || null;
  }

  // 设置项目列表（完全替换）
  function setItems(newItems: T[]) {
    items.value = [...newItems];
  }

  return {
    // 状态
    items,
    selectedId,
    selectedItem,
    showCreateDialog,
    showRenameDialog,
    newItemName,
    renameItemName,
    renameItemId,
    canCreate,
    canRename,
    
    // 方法
    loadItems,
    selectItem,
    createItem,
    updateItem,
    deleteItem,
    openCreateDialog,
    closeCreateDialog,
    openRenameDialog,
    closeRenameDialog,
    confirmRename,
    getItemById,
    setItems,
  };
}

