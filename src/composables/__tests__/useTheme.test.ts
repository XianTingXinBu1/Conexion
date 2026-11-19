// @vitest-environment happy-dom
/**
 * useTheme 单例语义回归测试。
 *
 * 以前每次调用 useTheme() 都会新建一份 theme ref + watcher：
 * AppProvider 与聊天页各拿一份，一处 toggle 后另一处还是旧值，
 * 而且两份 watcher 会各写一次 setting（重复 PUT）。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, fireEvent, waitFor, cleanup } from '@testing-library/vue';
import { defineComponent, h } from 'vue';

const { getSettingMock, setSettingMock } = vi.hoisted(() => ({
  getSettingMock: vi.fn(),
  setSettingMock: vi.fn(),
}));

vi.mock('@/repositories/settingsRepository', () => ({
  getSetting: getSettingMock,
  setSetting: setSettingMock,
}));

import { useTheme } from '../useTheme';

const Probe = defineComponent({
  name: 'ThemeProbe',
  setup() {
    const { theme, toggleTheme } = useTheme();
    return () =>
      h('div', { class: 'probe' }, [
        h('span', { class: 'theme' }, theme.value),
        h('button', { class: 'toggle', type: 'button', onClick: () => toggleTheme() }, 'toggle'),
      ]);
  },
});

const themeText = (container: Element): string =>
  container.querySelector('.theme')?.textContent?.trim() ?? '';

beforeEach(() => {
  cleanup();
  getSettingMock.mockReset();
  getSettingMock.mockResolvedValue('light');
  setSettingMock.mockReset();
  setSettingMock.mockResolvedValue(undefined);
  document.body.removeAttribute('data-theme');
});

describe('useTheme 单例', () => {
  it('多个调用方共享同一份主题状态', async () => {
    const first = render(Probe);
    const second = render(Probe);

    await waitFor(() => expect(themeText(first.container)).toBe('light'));
    await waitFor(() => expect(themeText(second.container)).toBe('light'));

    await fireEvent.click(first.container.querySelector('.toggle')!);

    // 第二份必须立刻看到同一状态（以前是各自的 ref，不会同步）
    await waitFor(() => expect(themeText(second.container)).toBe('dark'));
    expect(document.body.getAttribute('data-theme')).toBe('dark');
  });

  it('切换主题只写一次设置，读回的值不回写', async () => {
    const view = render(Probe);
    await waitFor(() => expect(themeText(view.container)).toBe('light'));

    // 读回后端主题不应触发写入
    expect(setSettingMock).not.toHaveBeenCalled();

    await fireEvent.click(view.container.querySelector('.toggle')!);
    await waitFor(() => expect(setSettingMock).toHaveBeenCalledTimes(1));
    expect(setSettingMock).toHaveBeenCalledWith('conexion_theme', 'dark');
  });

  it('加载主题失败时保持当前主题，不抛未处理的 rejection', async () => {
    getSettingMock.mockRejectedValue(new Error('网络异常'));

    const view = render(Probe);
    // 主题是模块级单例，基线值受前面的用例影响，这里只验证「能正常渲染且仍可切换」
    await waitFor(() => expect(view.container.querySelector('.theme')).not.toBeNull());

    const before = themeText(view.container);
    await fireEvent.click(view.container.querySelector('.toggle')!);
    await waitFor(() => expect(themeText(view.container)).toBe(before === 'dark' ? 'light' : 'dark'));
  });
});
