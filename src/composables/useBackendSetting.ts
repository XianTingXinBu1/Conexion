import { ref, watch, onMounted } from 'vue';
import { getSetting, setSetting } from '@/repositories/settingsRepository';

/**
 * 后端设置 Composable。
 * 数据来源是后端 /api/settings，而不是浏览器本地持久化。
 */
export function useBackendSetting<T>(key: string, defaultValue: T) {
  const value = ref<T>(defaultValue);
  const isLoading = ref(false);

  /**
   * 「这次赋值来自后端」标记。
   *
   * watch 用 `flush: 'sync'`，赋值语句内就会同步触发回调，因此这个布尔量
   * 只需在赋值的前后极短窗口里有效，不存在「等 nextTick 时被另一次加载清掉」
   * 的竞态。以前是异步 watch + nextTick 复位：两次加载并发时先返回的那次
   * 会把标记清掉，另一次远程赋值引起的 watch 就会把值原样 PUT 回后端。
   */
  let applyingRemoteValue = false;

  /**
   * 用户在加载期间改过值。
   *
   * getSetting 是网络请求，期间用户完全可能已经编辑过；远程结果回来时不能再覆盖，
   * 否则用户刚敲的内容会被「读到的旧值」冲掉。加载失败时同样不写默认值。
   */
  let userTouchedDuringLoad = false;

  const applyRemoteValue = (next: T) => {
    if (userTouchedDuringLoad) {
      return;
    }

    applyingRemoteValue = true;
    try {
      value.value = next;
    } finally {
      applyingRemoteValue = false;
    }
  };

  const loadValue = async () => {
    isLoading.value = true;
    userTouchedDuringLoad = false;

    try {
      applyRemoteValue(await getSetting(key, defaultValue));
    } catch (e) {
      // 失败保持当前值：回写 defaultValue 会把用户刚改的内容重置掉
      console.warn(`Failed to load setting ${key}:`, e);
    } finally {
      isLoading.value = false;
    }
  };

  const saveValue = async (val: T) => {
    try {
      await setSetting(key, val);
    } catch (e) {
      // 不再 rethrow：调用点是 fire-and-forget，抛出会变成未处理的 Promise rejection
      console.warn(`Failed to save setting ${key}:`, e);
    }
  };

  const refresh = () => {
    void loadValue();
  };

  watch(value, (newValue) => {
    // 读回来的值不再回写：否则每次打开设置页都会把后端已有的值原样 PUT 回去。
    if (applyingRemoteValue) return;

    userTouchedDuringLoad = true;
    void saveValue(newValue);
  }, { deep: true, flush: 'sync' });

  onMounted(() => {
    void loadValue();
  });

  return {
    value,
    isLoading,
    refresh,
  };
}
