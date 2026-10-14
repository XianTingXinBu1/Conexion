import { onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue';
import { getSetting, setSetting } from '@/repositories/settingsRepository';

/** 草稿由页面持有；临时会话不写后端，正式会话通过 settings 持久化。 */
export function useChatDraft(key: Ref<string | null>) {
  const draft = ref('');
  const draftError = ref('');
  let revision = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: Promise<unknown> = Promise.resolve();
  let disposed = false;
  let loading = true;
  let edited = false;
  let hydrating = false;

  const persist = (target: string, value: string) => {
    pending = pending.catch(() => {}).then(async () => {
      try {
        await setSetting(`chatDraft:${target}`, value);
        if (!disposed) draftError.value = '';
        return true;
      } catch (error) {
        if (!disposed) draftError.value = `草稿保存失败：${error instanceof Error ? error.message : '请重试'}`;
        return false;
      }
    });
    return pending;
  };

  const saveDraft = () => {
    clearTimeout(timer);
    if (key.value && edited) return persist(key.value, draft.value);
    return Promise.resolve();
  };

  watch(draft, () => {
    if (hydrating) return;
    revision += 1;
    edited = true;
    if (loading) return;
    clearTimeout(timer);
    timer = setTimeout(saveDraft, 300);
  }, { flush: 'sync' });

  // 新角色会话首次保存后取得正式 ID，将当前草稿迁移到该会话。
  watch(key, (next, previous) => {
    clearTimeout(timer);
    if (next) {
      void persist(next, draft.value).then(saved => {
        if (saved && previous && previous !== next) void persist(previous, '');
      });
    }
  });

  onMounted(async () => {
    window.addEventListener('pagehide', saveDraft);
    const target = key.value;
    const initialRevision = revision;
    try {
      if (target) {
        const saved = await getSetting<string>(`chatDraft:${target}`, '');
        if (!disposed && target === key.value && revision === initialRevision) {
          hydrating = true;
          draft.value = typeof saved === 'string' ? saved : '';
          hydrating = false;
        }
      }
    } catch (error) {
      if (!disposed) draftError.value = `草稿读取失败：${error instanceof Error ? error.message : '请重试'}`;
    } finally {
      loading = false;
      if (revision !== initialRevision) void saveDraft();
    }
  });

  onBeforeUnmount(() => {
    disposed = true;
    window.removeEventListener('pagehide', saveDraft);
    if (!loading && edited) void saveDraft();
    clearTimeout(timer);
  });

  return { draft, draftError, saveDraft };
}
