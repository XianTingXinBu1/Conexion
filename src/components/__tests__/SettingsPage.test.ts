// @vitest-environment happy-dom
/**
 * SettingsPage 页面级测试。
 *
 * 覆盖用户可见链路：
 * - 加载：从后端读回各项设置并反映到开关 / 选项 / 滑块的显示上
 * - 数据占用：按 `/api/settings` 全量内容算出体积并格式化展示
 * - 开关：切换后写回对应设置键（回车发送 / 显示词符数 / Markdown / 楼层数）
 * - 单选：提示词合并模式、会话压缩模式写回对应设置键
 * - 滑块：压缩阈值与初始加载消息数写回数字
 * - 恢复默认设置：确认框 → 写入全部默认值 → 界面回到默认态 + 提示
 * - 删除所有数据：确认框 → `DELETE /api/data`
 * - 注入上下文（AppProvider 提供）时，调试模式开关由注入的 debug 上下文驱动
 *
 * 设计约束与其他页面级测试一致：
 * - 只在 fetch 边界打桩，不 mock 业务模块，因此会真实穿过
 *   SettingsPage -> useAppSettings -> useBackendSetting / settingsRepository
 *   -> requestJson -> fetch 这条链路。
 * - 断言只看用户可见行为、发往本地的请求内容，以及通知内容。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor, type RenderResult } from '@testing-library/vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import { defineComponent, h, provide, ref } from 'vue';
import SettingsPage from '@/components/SettingsPage.vue';
import { useAppSettings } from '@/composables/useAppSettings';
import { APP_DEBUG_KEY, APP_SETTINGS_KEY } from '@/app/providers/appInjectionKeys';
import { useNotifications } from '@/modules/notification';

const KEYS = {
  enterToSend: 'conexion_enter_to_send',
  showWordCount: 'conexion_show_word_count',
  enableMarkdown: 'conexion_enable_markdown',
  showMessageIndex: 'conexion_show_message_index',
  chatHistoryLimit: 'conexion_chat_history_limit',
  promptMergeMode: 'conexion_prompt_merge_mode',
  compressionThresholdPercent: 'conexion_compression_threshold_percent',
  compressionMode: 'conexion_compression_mode',
} as const;

/** 后端数据（每个用例重置）：故意都用非默认值，便于验证「读回来」而不是「用默认值」 */
let settingsStore: Record<string, unknown> = {};
let savedSettings: { key: string; value: unknown }[] = [];
let deletedData = 0;

const { notifications, clearAll } = useNotifications();

const jsonResponse = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });

const getUrl = (input: RequestInfo | URL): string => {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
};

const handleRequest = async (input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> => {
  const url = getUrl(input);
  const method = (init.method ?? 'GET').toUpperCase();
  const body = init.body ? JSON.parse(String(init.body)) as Record<string, unknown> : undefined;

  if (url.includes('/api/data')) {
    if (method === 'DELETE') {
      deletedData += 1;
      return jsonResponse({ ok: true });
    }
    return jsonResponse({});
  }

  if (url.includes('/api/settings/')) {
    const key = decodeURIComponent(url.split('/api/settings/')[1]!.split('?')[0]!);
    if (method === 'PUT') {
      settingsStore[key] = body?.value;
      savedSettings.push({ key, value: body?.value });
      return jsonResponse({ value: body?.value });
    }
    return jsonResponse({ value: settingsStore[key] });
  }

  if (url.includes('/api/settings')) {
    return jsonResponse(settingsStore);
  }

  return jsonResponse({});
};

const fetchMock = vi.fn(handleRequest);

// ==================== 选择器 ====================

const q = <T extends Element>(root: ParentNode, selector: string): T => {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`未找到元素：${selector}`);
  return element;
};

const byText = <T extends HTMLElement>(root: ParentNode, selector: string, text: string): T => {
  const found = Array.from(root.querySelectorAll<T>(selector))
    .find(element => element.textContent?.trim() === text);
  if (!found) throw new Error(`未找到文本为「${text}」的 ${selector}`);
  return found;
};

/** 按标题找到开关行 */
const getToggle = (root: ParentNode, label: string): HTMLElement =>
  byText(root, '.toggle-label', label).closest<HTMLElement>('.toggle-item')!;

const toggleState = (root: ParentNode, label: string): string =>
  q(getToggle(root, label), '.toggle-btn').textContent?.trim() ?? '';

const getSelectorGroup = (root: ParentNode, label: string): HTMLElement =>
  byText(root, '.selector-label', label).closest<HTMLElement>('.selector-item')!;

const getSlider = (root: ParentNode, label: string): HTMLElement =>
  byText(root, '.slider-label', label).closest<HTMLElement>('.slider-item')!;

const getConfirmButton = (): HTMLButtonElement => q<HTMLButtonElement>(document.body, '.btn-confirm');

const toastTitles = (): string[] => notifications.value.map(item => item.title);

const savedValueOf = (key: string): unknown => {
  const matched = savedSettings.filter(entry => entry.key === key);
  return matched[matched.length - 1]?.value;
};

/** 与 DataManagementSection 相同的格式化口径 */
const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};

const renderSettingsPage = async (component = SettingsPage): Promise<RenderResult> => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', component: { template: '<div />' } }],
  });
  await router.push('/');
  await router.isReady();

  const view = render(component, { global: { plugins: [router] } });
  await waitFor(() => expect(view.container.querySelector('.settings-page')).not.toBeNull());
  // 设置值由 8 个独立请求读回，等最后一个（压缩模式）反映到界面
  await waitFor(() =>
    expect(q(getSelectorGroup(view.container, '会话压缩模式'), '.selector-option.active').textContent).toContain('自动压缩')
  );
  return view;
};

beforeEach(() => {
  settingsStore = {
    [KEYS.enterToSend]: false,
    [KEYS.showWordCount]: true,
    [KEYS.enableMarkdown]: false,
    [KEYS.showMessageIndex]: true,
    [KEYS.chatHistoryLimit]: 40,
    [KEYS.promptMergeMode]: 'all',
    [KEYS.compressionThresholdPercent]: 75,
    [KEYS.compressionMode]: 'auto',
  };
  savedSettings = [];
  deletedData = 0;
  clearAll();
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockClear();
});

afterEach(() => {
  clearAll();
  cleanup();
  vi.unstubAllGlobals();
});

describe('SettingsPage 加载与数据占用', () => {
  it('把后端设置读回界面，并展示数据占用体积', async () => {
    const view = await renderSettingsPage();

    expect(toggleState(view.container, '回车发送')).toBe('已禁用');
    expect(toggleState(view.container, '显示词符数')).toBe('已启用');
    expect(toggleState(view.container, 'Markdown 渲染')).toBe('已禁用');
    expect(toggleState(view.container, '显示楼层数')).toBe('已启用');
    expect(toggleState(view.container, '调试模式')).toBe('已禁用');

    expect(q(getSelectorGroup(view.container, '提示词合并模式'), '.selector-option.active').textContent)
      .toContain('全部合并');
    expect(q(getSlider(view.container, '压缩阈值'), '.slider-value').textContent?.trim()).toBe('75%');
    expect(q(getSlider(view.container, '初始加载消息数'), '.slider-value').textContent?.trim()).toBe('40 条');

    const expectedSize = formatBytes(new TextEncoder().encode(JSON.stringify(settingsStore)).length);
    await waitFor(() => expect(q(view.container, '.info-value').textContent?.trim()).toBe(expectedSize));
    // 只是读设置，不应该产生写入
    expect(savedSettings).toEqual([]);
  });
});

describe('SettingsPage 修改设置', () => {
  it('切换开关写回对应设置键', async () => {
    const view = await renderSettingsPage();

    await fireEvent.click(q(getToggle(view.container, '回车发送'), '.toggle-btn'));
    await waitFor(() => expect(savedValueOf(KEYS.enterToSend)).toBe(true));
    expect(toggleState(view.container, '回车发送')).toBe('已启用');

    await fireEvent.click(q(getToggle(view.container, 'Markdown 渲染'), '.toggle-btn'));
    await waitFor(() => expect(savedValueOf(KEYS.enableMarkdown)).toBe(true));
    expect(toggleState(view.container, 'Markdown 渲染')).toBe('已启用');

    await fireEvent.click(q(getToggle(view.container, '显示楼层数'), '.toggle-btn'));
    await waitFor(() => expect(savedValueOf(KEYS.showMessageIndex)).toBe(false));
    expect(toggleState(view.container, '显示楼层数')).toBe('已禁用');
  });

  it('选择合并模式与压缩模式写回对应设置键', async () => {
    const view = await renderSettingsPage();

    const mergeGroup = getSelectorGroup(view.container, '提示词合并模式');
    await fireEvent.click(byText<HTMLButtonElement>(mergeGroup, '.option-label', '不合并'));
    await waitFor(() => expect(savedValueOf(KEYS.promptMergeMode)).toBe('none'));
    expect(q(mergeGroup, '.selector-option.active').textContent).toContain('不合并');

    const compressionGroup = getSelectorGroup(view.container, '会话压缩模式');
    await fireEvent.click(byText<HTMLButtonElement>(compressionGroup, '.option-label', '手动压缩'));
    await waitFor(() => expect(savedValueOf(KEYS.compressionMode)).toBe('manual'));
    expect(q(compressionGroup, '.selector-option.active').textContent).toContain('手动压缩');
  });

  it('拖动滑块写回数字并更新显示', async () => {
    const view = await renderSettingsPage();

    const thresholdSlider = getSlider(view.container, '压缩阈值');
    await fireEvent.update(q<HTMLInputElement>(thresholdSlider, 'input[type="range"]'), '85');
    await waitFor(() => expect(savedValueOf(KEYS.compressionThresholdPercent)).toBe(85));
    expect(q(thresholdSlider, '.slider-value').textContent?.trim()).toBe('85%');

    const historySlider = getSlider(view.container, '初始加载消息数');
    await fireEvent.update(q<HTMLInputElement>(historySlider, 'input[type="range"]'), '60');
    await waitFor(() => expect(savedValueOf(KEYS.chatHistoryLimit)).toBe(60));
    expect(q(historySlider, '.slider-value').textContent?.trim()).toBe('60 条');
  });
});

describe('SettingsPage 数据管理', () => {
  it('恢复默认设置：确认后写入全部默认值并回到默认态', async () => {
    const view = await renderSettingsPage();

    await fireEvent.click(byText<HTMLButtonElement>(view.container, '.restore-btn', '恢复'));
    await waitFor(() => expect(document.body.querySelector('.btn-confirm')).not.toBeNull());
    expect(document.body.textContent).toContain('恢复默认设置');
    await fireEvent.click(getConfirmButton());

    await waitFor(() => expect(savedValueOf(KEYS.promptMergeMode)).toBe('adjacent'));
    expect(savedValueOf(KEYS.enterToSend)).toBe(true);
    expect(savedValueOf(KEYS.showWordCount)).toBe(false);
    expect(savedValueOf(KEYS.enableMarkdown)).toBe(true);
    expect(savedValueOf(KEYS.showMessageIndex)).toBe(false);
    expect(savedValueOf(KEYS.chatHistoryLimit)).toBe(20);
    expect(savedValueOf(KEYS.compressionThresholdPercent)).toBe(75);
    expect(savedValueOf(KEYS.compressionMode)).toBe('manual');

    await waitFor(() => expect(toggleState(view.container, '回车发送')).toBe('已启用'));
    expect(toggleState(view.container, 'Markdown 渲染')).toBe('已启用');
    expect(q(getSlider(view.container, '初始加载消息数'), '.slider-value').textContent?.trim()).toBe('20 条');
    await waitFor(() => expect(toastTitles()).toContain('设置已恢复'));
  });

  it('删除所有数据：确认后调用 DELETE /api/data', async () => {
    const view = await renderSettingsPage();

    await fireEvent.click(byText<HTMLButtonElement>(view.container, '.delete-btn', '删除'));
    await waitFor(() => expect(document.body.querySelector('.btn-confirm')).not.toBeNull());
    expect(document.body.textContent).toContain('此操作不可恢复');
    await fireEvent.click(getConfirmButton());

    await waitFor(() => expect(deletedData).toBe(1));
    expect(savedSettings).toEqual([]);
  });
});

describe('SettingsPage 注入上下文', () => {
  it('有 AppProvider 注入时，调试模式开关由注入的 debug 上下文驱动', async () => {
    // 模拟 AppProvider 的提供方式：真实的 useAppSettings 实例 + debug 上下文
    const Wrapper = defineComponent({
      setup() {
        const appSettings = useAppSettings();
        const debugMode = ref(false);
        provide(APP_SETTINGS_KEY, appSettings);
        provide(APP_DEBUG_KEY, {
          debugMode,
          toggleDebugMode: () => {
            debugMode.value = !debugMode.value;
          },
        });
        return () => h(SettingsPage);
      },
    });

    const view = await renderSettingsPage(Wrapper);

    expect(toggleState(view.container, '调试模式')).toBe('已禁用');
    await fireEvent.click(q(getToggle(view.container, '调试模式'), '.toggle-btn'));

    await waitFor(() => expect(toggleState(view.container, '调试模式')).toBe('已启用'));
  });
});
