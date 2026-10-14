// @vitest-environment happy-dom
/**
 * AppProvider 集成测试（应用外壳）。
 *
 * AppProvider 自己不渲染 UI，职责是把主题 / 调试 / 设置 / 数据四组上下文
 * 通过 `provide` 交给整棵路由树。这里用一个探针子组件去消费这四组上下文，
 * 验证注入出去的东西确实可用、可改：
 * - 主题：从后端读回并应用到 `<body data-theme>`；切换后写回设置键
 * - 调试：切换开关写回 `conexion_debug_mode`
 * - 设置：使用真实的 useAppSettings，值反映后端
 * - 数据：`selectedUser` 来自初始化加载，`deleteAllData` 触发 DELETE
 *
 * 设计约束与其他页面级测试一致：只在 fetch 边界打桩，不 mock 业务模块。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/vue';
import { defineComponent, h, inject } from 'vue';
import AppProvider from '@/components/AppProvider.vue';
import {
  APP_DATA_KEY,
  APP_DEBUG_KEY,
  APP_SETTINGS_KEY,
  APP_THEME_KEY,
} from '@/app/providers/appInjectionKeys';
import type { AICharacter, UserCharacter } from '@/types';

const KEYS = {
  theme: 'conexion_theme',
  debugMode: 'conexion_debug_mode',
  enterToSend: 'conexion_enter_to_send',
  selectedUser: 'conexion_selected_user_character',
} as const;

const userCharacter: UserCharacter = { id: 'user-1', name: '小明', description: '本人', createdAt: 1 };
const aiCharacter: AICharacter = { id: 'ai-1', name: '助手', description: '友好', personality: '耐心', createdAt: 1 };

let settingsStore: Record<string, unknown> = {};
let savedSettings: { key: string; value: unknown }[] = [];
let deletedData = 0;

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

  if (url.includes('/api/data') && method === 'DELETE') {
    deletedData += 1;
    return jsonResponse({ ok: true });
  }

  if (url.includes('/api/characters/users')) {
    return jsonResponse([userCharacter]);
  }

  if (url.includes('/api/characters/ai')) {
    return jsonResponse([aiCharacter]);
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

  return jsonResponse({});
};

const fetchMock = vi.fn(handleRequest);

const q = <T extends Element>(root: ParentNode, selector: string): T => {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`未找到元素：${selector}`);
  return element;
};

const savedValueOf = (key: string): unknown => {
  const matched = savedSettings.filter(entry => entry.key === key);
  return matched[matched.length - 1]?.value;
};

/** 消费 AppProvider 四组上下文的探针组件 */
const Probe = defineComponent({
  name: 'Probe',
  setup() {
    const theme = inject(APP_THEME_KEY)!;
    const debug = inject(APP_DEBUG_KEY)!;
    const settings = inject(APP_SETTINGS_KEY)!;
    const data = inject(APP_DATA_KEY)!;
    // 上下文里装的是 ref / computed，必须作为顶层绑定返回才会被模板解包
    return {
      themeValue: theme.theme,
      debugValue: debug.debugMode,
      enterValue: settings.enterToSend,
      selectedUser: data.selectedUser,
      toggleTheme: theme.toggleTheme,
      toggleDebugMode: debug.toggleDebugMode,
      deleteAllData: data.deleteAllData,
    };
  },
  template: `
    <div class="probe">
      <span class="probe-theme">{{ themeValue }}</span>
      <span class="probe-debug">{{ debugValue }}</span>
      <span class="probe-enter">{{ enterValue }}</span>
      <span class="probe-user">{{ selectedUser?.name ?? '无' }}</span>
      <button class="probe-toggle-theme" @click="toggleTheme()">切换主题</button>
      <button class="probe-toggle-debug" @click="toggleDebugMode()">切换调试</button>
      <button class="probe-wipe" @click="deleteAllData()">清空数据</button>
    </div>
  `,
});

const renderProvider = async () => {
  const view = render(AppProvider, { slots: { default: () => h(Probe) } });
  await waitFor(() => expect(view.container.querySelector('.probe')).not.toBeNull());
  // 等初始化加载（用户角色 → AI 角色 → 选中用户）全部落定
  await waitFor(() => expect(q(view.container, '.probe-user').textContent?.trim()).toBe(userCharacter.name));
  return view;
};

beforeEach(() => {
  settingsStore = {
    [KEYS.theme]: 'dark',
    [KEYS.debugMode]: false,
    [KEYS.enterToSend]: false,
    [KEYS.selectedUser]: userCharacter.id,
  };
  savedSettings = [];
  deletedData = 0;
  document.body.removeAttribute('data-theme');
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockClear();
});

afterEach(() => {
  cleanup();
  document.body.removeAttribute('data-theme');
  vi.unstubAllGlobals();
});

describe('AppProvider 主题上下文', () => {
  it('读回后端主题并应用到 body，切换后写回设置键', async () => {
    const view = await renderProvider();

    await waitFor(() => expect(document.body.getAttribute('data-theme')).toBe('dark'));
    expect(q(view.container, '.probe-theme').textContent?.trim()).toBe('dark');

    await fireEvent.click(q(view.container, '.probe-toggle-theme'));

    await waitFor(() => expect(q(view.container, '.probe-theme').textContent?.trim()).toBe('light'));
    expect(document.body.hasAttribute('data-theme')).toBe(false);
    await waitFor(() => expect(savedValueOf(KEYS.theme)).toBe('light'));
  });
});

describe('AppProvider 调试与设置上下文', () => {
  it('切换调试模式写回设置键', async () => {
    const view = await renderProvider();

    expect(q(view.container, '.probe-debug').textContent?.trim()).toBe('false');

    await fireEvent.click(q(view.container, '.probe-toggle-debug'));

    await waitFor(() => expect(q(view.container, '.probe-debug').textContent?.trim()).toBe('true'));
    await waitFor(() => expect(savedValueOf(KEYS.debugMode)).toBe(true));
  });

  it('设置上下文暴露后端里的值', async () => {
    const view = await renderProvider();

    await waitFor(() => expect(q(view.container, '.probe-enter').textContent?.trim()).toBe('false'));
    // 读设置不应该回写设置
    expect(savedSettings).toEqual([]);
  });
});

describe('AppProvider 数据上下文', () => {
  it('初始化后暴露选中的用户角色，deleteAllData 走 DELETE /api/data', async () => {
    const view = await renderProvider();

    expect(q(view.container, '.probe-user').textContent?.trim()).toBe(userCharacter.name);

    await fireEvent.click(q(view.container, '.probe-wipe'));

    await waitFor(() => expect(deletedData).toBe(1));
  });
});
