// @vitest-environment happy-dom
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import { cleanup, render, waitFor } from '@testing-library/vue';
import { loadRegexRules, saveRegexRules } from '@/repositories/regexRuleRepository';
import { useRegexRules } from '../useRegexRules';

vi.mock('@/repositories/regexRuleRepository', () => ({ loadRegexRules: vi.fn(), saveRegexRules: vi.fn() }));
const rule = { id: 'one', name: '替换', pattern: 'a', flags: 'g', replacement: 'b', enabled: true, scope: 'all' as const, applyTo: 'after-macro' as const };
let state: ReturnType<typeof useRegexRules>;
async function mountRules() {
  render(defineComponent({ setup() { state = useRegexRules(); return () => h('div'); } }));
  await waitFor(() => expect(state.isLoading.value).toBe(false));
}
beforeEach(() => { vi.clearAllMocks(); vi.mocked(loadRegexRules).mockResolvedValue([{ ...rule }]); vi.mocked(saveRegexRules).mockResolvedValue(); });
afterEach(cleanup);

describe('regex persistence', () => {
  it('waits for persistence, retains old state on failure and permits retry', async () => {
    await mountRules();
    let reject!: (reason: Error) => void;
    vi.mocked(saveRegexRules).mockReturnValueOnce(new Promise<void>((_, fail) => { reject = fail; }));
    const operation = state.updateRule('one', { replacement: 'c' });
    const failed = expect(operation).rejects.toThrow('断网');
    expect(state.isSaving.value).toBe(true);
    expect(state.rules.value[0]!.replacement).toBe('b');
    reject(new Error('断网'));
    await failed;
    expect(state.rules.value[0]!.replacement).toBe('b');
    expect(state.error.value).toBe('断网');
    await state.updateRule('one', { replacement: 'c' });
    expect(state.rules.value[0]!.replacement).toBe('c');
    expect(state.error.value).toBe('');
  });

  it('rejects malformed expressions before saving', async () => {
    await mountRules();
    await expect(state.updateRule('one', { pattern: '[' })).rejects.toThrow('无效');
    await expect(state.updateRule('one', { flags: 'gg' })).rejects.toThrow('无效');
    expect(saveRegexRules).not.toHaveBeenCalled();
  });

  it('keeps the last-rule deletion empty after reloading', async () => {
    await mountRules();
    await state.deleteRule('one');
    expect(saveRegexRules).toHaveBeenCalledWith([]);
    expect(state.rules.value).toEqual([]);
    vi.mocked(loadRegexRules).mockResolvedValue([]);
    await state.loadRules();
    expect(state.rules.value).toEqual([]);
  });
});
