import { ref, watch, onMounted, nextTick } from 'vue';
import { getSetting, setSetting } from '@/repositories/settingsRepository';

/**
 * 后端设置 Composable。
 * 数据来源是后端 /api/settings，而不是浏览器本地持久化。
 */
export function useBackendSetting<T>(key: string, defaultValue: T) {
  const value = ref<T>(defaultValue);
  const isLoading = ref(false);

  /**
   * 标记「当前这次赋值来自后端」。
   *
   * watch 是在微任务里触发的，而赋值后函数可能马上就返回了，
   * 拿 isLoading 当标志并不可靠，所以显式等一次 nextTick：
   * 让这次远程赋值引起的 watch 回调先跑完（被跳过），再清除标志。
   */
  let applyingRemoteValue = false;

  const applyRemoteValue = async (next: T) => {
    applyingRemoteValue = true;
    value.value = next;
    await nextTick();
    applyingRemoteValue = false;
  };

  const loadValue = async () => {
    isLoading.value = true;
    try {
      await applyRemoteValue(await getSetting(key, defaultValue));
    } catch (e) {
      console.warn(`Failed to load setting ${key}:`, e);
      await applyRemoteValue(defaultValue);
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
    // 读回来的值不再回写：否则每次打开设置页都会把后端已有的值原样 PUT 回去。
    if (applyingRemoteValue) return;

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
