// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, ref } from 'vue';
import { cleanup, render, waitFor } from '@testing-library/vue';
import { getSetting, setSetting } from '@/repositories/settingsRepository';
import { useChatDraft } from '../useChatDraft';

vi.mock('@/repositories/settingsRepository', () => ({ getSetting: vi.fn(), setSetting: vi.fn() }));
let state: ReturnType<typeof useChatDraft>;
const mountDraft = (target: string | null) => {
  const key = ref(target);
  const view = render(defineComponent({ setup() { state = useChatDraft(key); return () => h('div'); } }));
  return { ...view, key };
};
beforeEach(() => { vi.clearAllMocks(); vi.mocked(getSetting).mockResolvedValue(''); vi.mocked(setSetting).mockResolvedValue(''); });
afterEach(async () => { cleanup(); await Promise.resolve(); });

describe('chat drafts', () => {
  it('restores and saves per-conversation drafts on leaving', async () => {
    vi.mocked(getSetting).mockResolvedValue('未发送内容');
    const view = mountDraft('conversation:one');
    await waitFor(() => expect(state.draft.value).toBe('未发送内容'));
    state.draft.value = '修改后的草稿';
    view.unmount();
    await waitFor(() => expect(setSetting).toHaveBeenCalledWith('chatDraft:conversation:one', '修改后的草稿'));
    mountDraft('conversation:two');
    expect(getSetting).toHaveBeenLastCalledWith('chatDraft:conversation:two', '');
  });

  it('does not overwrite typing with a delayed load', async () => {
    let resolve!: (value: string) => void;
    vi.mocked(getSetting).mockReturnValue(new Promise<string>(done => { resolve = done; }));
    mountDraft('conversation:one');
    state.draft.value = '新输入';
    resolve('旧草稿');
    await waitFor(() => expect(setSetting).toHaveBeenCalledWith('chatDraft:conversation:one', '新输入'));
    expect(state.draft.value).toBe('新输入');
  });

  it('keeps temporary drafts in memory only', async () => {
    const view = mountDraft(null);
    state.draft.value = '临时内容';
    await state.saveDraft();
    view.unmount();
    expect(getSetting).not.toHaveBeenCalled();
    expect(setSetting).not.toHaveBeenCalled();
  });

  it('moves a new character draft to its saved conversation', async () => {
    const view = mountDraft('character:one');
    await waitFor(() => expect(getSetting).toHaveBeenCalled());
    state.draft.value = '下一条';
    view.key.value = 'conversation:new';
    await waitFor(() => expect(setSetting).toHaveBeenCalledWith('chatDraft:conversation:new', '下一条'));
    expect(setSetting).toHaveBeenCalledWith('chatDraft:character:one', '');
  });

  it('reports a failed save, retaining content and allowing retry', async () => {
    mountDraft('conversation:one');
    await waitFor(() => expect(getSetting).toHaveBeenCalled());
    vi.mocked(setSetting).mockRejectedValueOnce(new Error('断网'));
    state.draft.value = '保留内容';
    await state.saveDraft();
    expect(state.draftError.value).toContain('断网');
    expect(state.draft.value).toBe('保留内容');
    await state.saveDraft();
    expect(state.draftError.value).toBe('');
  });
});
