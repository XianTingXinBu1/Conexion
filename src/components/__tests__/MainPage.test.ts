// @vitest-environment happy-dom
/**
 * MainPage 页面级测试。
 *
 * 覆盖用户可见链路：
 * - 渲染：品牌、主入口卡片、内容管理四宫格、配置列表两项
 * - 导航：每个入口都跳到对应路由
 * - 主题：没有 AppProvider 注入时按浅色渲染（太阳图标、点击不报错）；
 *   注入主题上下文时跟随注入的 theme，并在点击时调用注入的 toggleTheme
 *
 * 设计约束与其他页面级测试一致：
 * - 只在 fetch 边界打桩（本页不发请求，因此只验证「不发请求」）；
 *   注入的 AppProvider 上下文用真实的 ref + 切换函数模拟，不 mock 业务模块。
 * - 断言只看用户可见行为与最终路由。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor, type RenderResult } from '@testing-library/vue';
import { createMemoryHistory, createRouter, type Router } from 'vue-router';
import { defineComponent, h, provide, ref } from 'vue';
import MainPage from '@/components/MainPage.vue';
import { APP_THEME_KEY } from '@/app/providers/appInjectionKeys';
import type { Theme } from '@/types';

const q = <T extends Element>(root: ParentNode, selector: string): T => {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`未找到元素：${selector}`);
  return element;
};

/** 本页是纯导航页：渲染与跳转都不应该发出任何请求 */
const fetchMock = vi.fn(async () => {
  throw new Error('MainPage 不应该发请求');
});

/** 主题图标：lucide 会把图标名写进 svg 的 class */
const themeIcon = (root: ParentNode): string => q(root, '.theme-toggle svg').getAttribute('class') ?? '';

const renderPage = async (component = MainPage): Promise<{ view: RenderResult; router: Router }> => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/conversation-list', component: { template: '<div />' } },
      { path: '/role-management', component: { template: '<div />' } },
      { path: '/knowledge-base', component: { template: '<div />' } },
      { path: '/prompt-preset', component: { template: '<div />' } },
      { path: '/regex-script', component: { template: '<div />' } },
      { path: '/api-preset', component: { template: '<div />' } },
      { path: '/settings', component: { template: '<div />' } },
    ],
  });
  await router.push('/');
  await router.isReady();

  const view = render(component, { global: { plugins: [router] } });
  await waitFor(() => expect(view.container.querySelector('.main-page')).not.toBeNull());
  return { view, router };
};

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockClear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('MainPage 渲染', () => {
  it('展示品牌、主入口、内容管理四宫格与配置列表', async () => {
    const { view } = await renderPage();

    expect(view.getByText('Conexion')).toBeTruthy();
    expect(view.getByText('开始对话')).toBeTruthy();
    expect(view.getByText('创建新的会话或继续之前的对话')).toBeTruthy();

    expect(Array.from(view.container.querySelectorAll('.grid-label')).map(el => el.textContent?.trim()))
      .toEqual(['角色卡', '知识库', '提示词', '正则脚本']);
    expect(Array.from(view.container.querySelectorAll('.list-label')).map(el => el.textContent?.trim()))
      .toEqual(['API 预设', '设置']);
    expect(view.getByText('配置 API 密钥和模型参数')).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('MainPage 导航', () => {
  it('点击各入口跳到对应路由', async () => {
    const { view, router } = await renderPage();

    const entries: [string, string][] = [
      ['开始对话', '/conversation-list'],
      ['角色卡', '/role-management'],
      ['知识库', '/knowledge-base'],
      ['提示词', '/prompt-preset'],
      ['正则脚本', '/regex-script'],
      ['API 预设', '/api-preset'],
      ['设置', '/settings'],
    ];

    for (const [label, path] of entries) {
      await fireEvent.click(view.getByText(label));
      await waitFor(() => expect(router.currentRoute.value.fullPath).toBe(path));
    }
  });
});

describe('MainPage 主题', () => {
  it('没有 AppProvider 注入时按浅色渲染，点击主题按钮不报错', async () => {
    const { view } = await renderPage();

    expect(themeIcon(view.container)).toContain('lucide-sun');
    await fireEvent.click(q(view.container, '.theme-toggle'));
    expect(themeIcon(view.container)).toContain('lucide-sun');
  });

  it('注入主题上下文时跟随注入的主题，并在点击时切换', async () => {
    const theme = ref<Theme>('dark');
    const Wrapper = defineComponent({
      setup() {
        provide(APP_THEME_KEY, {
          theme,
          toggleTheme: () => {
            theme.value = theme.value === 'dark' ? 'light' : 'dark';
          },
        });
        return () => h(MainPage);
      },
    });

    const { view } = await renderPage(Wrapper);

    expect(themeIcon(view.container)).toContain('lucide-moon');
    await fireEvent.click(q(view.container, '.theme-toggle'));

    await waitFor(() => expect(theme.value).toBe('light'));
    await waitFor(() => expect(themeIcon(view.container)).toContain('lucide-sun'));
  });
});
