// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import RegexScriptPage from '../RegexScriptPage.vue';

const showSuccess = vi.fn();
const showError = vi.fn();
vi.mock('@/modules/notification', () => ({
  useNotifications: () => ({ showSuccess, showInfo: vi.fn(), showError }),
  getNotificationMessage: () => ({ title: '成功', message: '已保存' }),
}));
const fetchMock = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockResolvedValue(new Response('[]', { headers: { 'Content-Type': 'application/json' } }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('RegexScriptPage', () => {
  it('validates and previews a rule, keeps its form on failed save, then retries', async () => {
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { template: '<div />' } }] });
    const view = render(RegexScriptPage, { global: { plugins: [router] } });
    await waitFor(() => expect(view.queryByText('正在加载规则…')).toBeNull());
    await fireEvent.click(view.container.querySelector('.page-header button:last-child')!);
    await waitFor(() => expect(view.queryByText('新建规则')).not.toBeNull());
    const inputs = view.container.querySelectorAll<HTMLInputElement>('.regex-rule-form input');
    await fireEvent.update(inputs[0]!, '清理');
    await fireEvent.update(inputs[1]!, '[');
    const add = view.getByRole('button', { name: '添加' }) as HTMLButtonElement;
    expect(add.disabled).toBe(true);
    expect(view.getByRole('alert').textContent).toContain('无效');
    await fireEvent.update(inputs[1]!, 'a');
    await fireEvent.update(inputs[3]!, 'b');
    await fireEvent.update(view.container.querySelector('.regex-rule-form textarea')!, 'a a');
    expect(view.container.querySelector('.regex-preview')!.textContent).toBe('b b');
    let resolve!: (response: Response) => void;
    fetchMock.mockReturnValueOnce(new Promise<Response>(done => { resolve = done; }));
    await fireEvent.click(add);
    expect(showSuccess).not.toHaveBeenCalled();
    expect(add.disabled).toBe(true);
    resolve(new Response(JSON.stringify({ error: { message: '磁盘已满' } }), { status: 500, headers: { 'Content-Type': 'application/json' } }));
    await waitFor(() => expect(showError).toHaveBeenCalledWith('操作失败', '磁盘已满'));
    expect(inputs[0]!.value).toBe('清理');
    expect(view.queryByText('新建规则')).not.toBeNull();
    fetchMock.mockResolvedValueOnce(new Response('[]', { headers: { 'Content-Type': 'application/json' } }));
    await fireEvent.click(add);
    await waitFor(() => expect(view.queryByText('新建规则')).toBeNull());
    expect(showSuccess).toHaveBeenCalledTimes(1);
    expect(view.getByText('清理')).toBeTruthy();
  });
});
