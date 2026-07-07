import { ref, watch, onMounted } from 'vue';
import { getSetting, setSetting } from '@/repositories/settingsRepository';

/**
 * 后端设置 Composable。
 * 数据来源是后端 /api/settings，而不是浏览器本地持久化。
 */
export function useBackendSetting<T>(key: string, defaultValue: T) {
  const value = ref<T>(defaultValue);
  const isLoading = ref(false);

  const loadValue = async () => {
    isLoading.value = true;
    try {
      value.value = await getSetting(key, defaultValue);
    } catch (e) {
      console.warn(`Failed to load setting ${key}:`, e);
      value.value = defaultValue;
    } finally {
      isLoading.value = false;
    }
  };

  const saveValue = async (val: T) => {
    try {
      await setSetting(key, val);
    } catch (e) {
      console.warn(`Failed to save setting ${key}:`, e);
      throw e;
    }
  };

  const refresh = () => {
    void loadValue();
  };

  watch(value, (newValue) => {
    void saveValue(newValue);
  }, { deep: true });

  onMounted(() => {
    void loadValue();
  });

  return {
    value,
    isLoading,
    refresh,
  };
}
