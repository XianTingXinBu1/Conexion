import { ref, watch, onMounted } from 'vue';
import { getStorage, setStorage } from '@/utils/storage';

/**
 * 混合存储管理 Composable
 * 自动根据键选择 localStorage 或 IndexedDB 存储
 */
export function useLocalStorage<T>(key: string, defaultValue: T) {
  const value = ref<T>(defaultValue);
  const isLoading = ref(false);

  // 从存储加载值
  const loadValue = async () => {
    isLoading.value = true;
    try {
      value.value = await getStorage(key, defaultValue);
    } catch (e) {
      console.warn(`Failed to load ${key}:`, e);
      value.value = defaultValue;
    } finally {
      isLoading.value = false;
    }
  };

  // 保存值到存储
  const saveValue = async (val: T) => {
    try {
      await setStorage(key, val);
    } catch (e) {
      console.warn(`Failed to save ${key}:`, e);
      throw e;
    }
  };

  // 手动刷新值
  const refresh = () => {
    loadValue();
  };

  // 监听值变化，自动保存
  watch(value, (newValue) => {
    saveValue(newValue);
  }, { deep: true });

  // 组件挂载时加载值
  onMounted(() => {
    loadValue();
  });

  return {
    value,
    isLoading,
    refresh,
  };
}