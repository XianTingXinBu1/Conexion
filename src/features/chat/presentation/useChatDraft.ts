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

  /** 临时会话的 key 形如 `character:<id>`，只有它拿到正式会话 ID 时才需要迁移草稿 */
  const TEMP_KEY_PREFIX = 'character:';

  const loadDraft = async (target: string): Promise<void> => {
    const initialRevision = revision;
    try {
      const saved = await getSetting<string>(`chatDraft:${target}`, '');
      // 期间用户已经输入（revision 变了）或 key 又切走了：不要用旧值盖掉新内容
      if (disposed || target !== key.value || revision !== initialRevision) return;
      hydrating = true;
      draft.value = typeof saved === 'string' ? saved : '';
      hydrating = false;
    } catch (error) {
      if (!disposed) draftError.value = `草稿读取失败：${error instanceof Error ? error.message : '请重试'}`;
    } finally {
      loading = false;
      if (revision !== initialRevision) void saveDraft();
    }
  };

  // 会话切换时的草稿归属：
  // - 临时 `character:*` 会话拿到正式 ID → 迁移（把当前草稿写到新 key，再清掉临时 key）
  // - 正式会话之间切换 → 各存各的：先保存旧草稿，再载入新草稿
  //   （否则 A 的输入会被写进 B，同时 A 已持久化的草稿还会被清空）
  watch(key, (next, previous) => {
    clearTimeout(timer);
    if (!next || next === previous) return;

    if (previous && previous.startsWith(TEMP_KEY_PREFIX)) {
      if (!edited) return;
      void persist(next, draft.value).then(saved => {
        if (saved && previous) void persist(previous, '');
      });
      return;
    }

    if (previous && edited) void persist(previous, draft.value);
    edited = false;
    void loadDraft(next);
  });

  onMounted(async () => {
    window.addEventListener('pagehide', saveDraft);
    const target = key.value;
    if (target) {
      await loadDraft(target);
    } else {
      loading = false;
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
