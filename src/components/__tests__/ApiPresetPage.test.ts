// @vitest-environment happy-dom
/**
 * ApiPresetPage 页面级测试。
 *
 * 覆盖四条用户可见链路：
 * - 保存：编辑表单 -> 点击保存 -> `PUT /api/api-presets` 带上修改后的字段
 * - 切换预设：选择另一个预设 -> 表单载入该预设 + 后端记住新的选中项
 * - 测试连接：`POST /api/connection-test`，期间按钮进入「测试中」
 * - 获取模型列表：`POST /api/models`，成功后把模型缓存写回设置
 *
 * 设计约束与 `ChatPage.sendFlow.test.ts` 一致：
 * - 只在 fetch 边界打桩，不 mock 业务模块，因此会真实穿过
 *   ApiPresetPage -> useApiPresets / useApiModels / useApiConnection
 *   -> repository / ModelsApi -> fetch 这条链路。
 * - 断言只看用户可见行为、发往本地的请求内容，以及通知内容，
 *   不锁内部实现细节。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import ApiPresetPage from '@/components/ApiPresetPage.vue';
import { useNotifications } from '@/modules/notification';
import { SETTING_KEYS } from '@/constants';
import type { Preset } from '@/types';

const PRESET_A: Preset = {
  id: 'default',
  name: '默认预设',
  url: 'https://a.example.com/v1',
  apiKey: 'key-a',
  model: 'model-a',
  streamEnabled: true,
  temperature: 0.7,
  topP: 1,
  frequencyPenalty: 0,
  presencePenalty: 0,
  stopSequences: [],
  contextLength: 8192,
  maxOutputTokens: 4096,
  createdAt: 1,
  updatedAt: 1,
};

const PRESET_B: Preset = {
  ...PRESET_A,
  id: 'preset-b',
  name: '备用预设',
  url: 'https://b.example.com/v1',
  apiKey: 'key-b',
  model: 'model-b',
  contextLength: 4096,
};

interface ConnectionResult {
  ok: boolean;
  status?: number;
  message?: string;
}

interface ModelsResult {
  ok: boolean;
  list: string[];
  message?: string;
}

interface RecordedRequest {
  method: string;
  url: string;
}

/** 后端数据（每个用例重置） */
let presetStore: Preset[] = [];
let settingsStore: Record<string, unknown> = {};

/** 观测到的本地请求 */
let requestLog: RecordedRequest[] = [];
let savedPresetPayloads: Preset[][] = [];
let settingsPuts: { key: string; value: unknown }[] = [];
let modelRequests: Record<string, unknown>[] = [];
let connectionRequests: Record<string, unknown>[] = [];

let connectionResult: ConnectionResult = { ok: true };
let modelsResult: ModelsResult = { ok: true, list: ['gpt-4o', 'gpt-4o-mini'] };

/** 用于卡住 /api/connection-test 的闸门，测试「测试中」这个窗口 */
let connectionGate: { promise: Promise<void>; release: () => void } | null = null;

const armConnectionGate = () => {
  let release!: () => void;
  const promise = new Promise<void>(resolve => {
    release = resolve;
  });
  connectionGate = { promise, release };
};

const releaseConnectionGate = () => {
  connectionGate?.release();
  connectionGate = null;
};

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
  requestLog.push({ method, url });

  if (url.includes('/api/health')) return jsonResponse({ ok: true });

  if (url.includes('/api/settings/')) {
    const key = decodeURIComponent(url.split('/api/settings/')[1] ?? '').split('?')[0] ?? '';

    if (method === 'PUT') {
      const body = JSON.parse(String(init.body)) as { value: unknown };
      settingsStore[key] = body.value;
      settingsPuts.push({ key, value: body.value });
      return jsonResponse({ value: body.value });
    }

    return jsonResponse({ value: settingsStore[key] });
  }

  if (url.includes('/api/api-presets')) {
    if (method === 'PUT') {
      const body = JSON.parse(String(init.body)) as { presets: Preset[] };
      presetStore = body.presets;
      savedPresetPayloads.push(body.presets);
      return jsonResponse(presetStore);
    }

    return jsonResponse(presetStore);
  }

  if (url.includes('/api/connection-test')) {
    connectionRequests.push(JSON.parse(String(init.body)) as Record<string, unknown>);
    const gate = connectionGate;
    if (gate) await gate.promise;

    if (!connectionResult.ok) {
      return jsonResponse(
        { error: { message: connectionResult.message ?? '连接失败' } },
        connectionResult.status ?? 401,
      );
    }

    return jsonResponse({ ok: true });
  }

  if (url.includes('/api/models')) {
    modelRequests.push(JSON.parse(String(init.body)) as Record<string, unknown>);

    if (!modelsResult.ok) {
      return jsonResponse({ error: { message: modelsResult.message ?? '上游不可用' } }, 500);
    }

    return jsonResponse({ data: modelsResult.list.map(id => ({ id, name: id })) });
  }

  return jsonResponse([]);
};

const fetchMock = vi.fn(handleRequest);

// ==================== 选择器 ====================

const getUrlInput = (container: Element): HTMLInputElement => {
  const input = container.querySelector<HTMLInputElement>('input[placeholder="https://api.openai.com/v1"]');
  if (!input) throw new Error('未找到 URL 输入框');
  return input;
};

const getTestConnectionButton = (container: Element): HTMLButtonElement => {
  const button = container.querySelector<HTMLButtonElement>('.test-btn');
  if (!button) throw new Error('未找到测试连接按钮');
  return button;
};

const getFetchModelsButton = (container: Element): HTMLButtonElement => {
  const button = container.querySelector<HTMLButtonElement>('.fetch-models-btn');
  if (!button) throw new Error('未找到获取模型列表按钮');
  return button;
};

const getSaveButton = (container: Element): HTMLButtonElement => {
  const buttons = container.querySelectorAll<HTMLButtonElement>('.page-header .nav-btn');
  const saveButton = buttons[buttons.length - 1];
  if (!saveButton) throw new Error('未找到保存按钮');
  return saveButton;
};

const getPresetSelectorButton = (container: Element): HTMLButtonElement => {
  const button = container.querySelector<HTMLButtonElement>('.selector-btn');
  if (!button) throw new Error('未找到预设选择器');
  return button;
};

const getPresetLabel = (container: Element): string =>
  getPresetSelectorButton(container).querySelector('span')?.textContent?.trim() ?? '';

const getPresetItem = (container: Element, name: string): HTMLElement => {
  const items = Array.from(container.querySelectorAll<HTMLElement>('.preset-item'));
  const item = items.find(el => el.querySelector('.preset-name')?.textContent?.trim() === name);
  if (!item) throw new Error(`未找到预设项：${name}`);
  return item;
};

const toastByTitle = (title: string) => notifications.value.find(item => item.title === title);

/**
 * 挂载页面并等到挂载期的异步初始化**完整**结束。
 *
 * 只等 URL 输入框是不够的：`loadPresets()` 内部先写 `presets`（会触发
 * `onPresetChange` 把表单填成第一个预设），之后才 `await loadSelectedPreset()`。
 * 若在此时就继续，切换预设会被随后返回的 `loadSelectedPreset` 覆盖回默认项。
 * `loadModels()` 的 settings 读取发生在 `await loadPresets()` 之后，
 * 因此看到它就说明整条初始化链已经跑完。
 */
const renderPage = async () => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', component: { template: '<div />' } }],
  });

  await router.push('/');
  await router.isReady();

  const view = render(ApiPresetPage, { global: { plugins: [router] } });

  await waitFor(() => {
    expect(
      requestLog.some(
        request =>
          request.method === 'GET' && request.url.includes(`/api/settings/${SETTING_KEYS.MODELS}`),
      ),
    ).toBe(true);
    expect(getUrlInput(view.container).value).toBe(PRESET_A.url);
  });

  return view;
};

beforeEach(() => {
  presetStore = [structuredClone(PRESET_A), structuredClone(PRESET_B)];
  settingsStore = {};
  requestLog = [];
  savedPresetPayloads = [];
  settingsPuts = [];
  modelRequests = [];
  connectionRequests = [];
  connectionResult = { ok: true };
  modelsResult = { ok: true, list: ['gpt-4o', 'gpt-4o-mini'] };
  connectionGate = null;

  clearAll();
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockClear();
});

afterEach(() => {
  clearAll();
  cleanup();
  vi.unstubAllGlobals();
});

describe('ApiPresetPage 预设保存与切换', () => {
  it('保存：把编辑后的表单写回 /api/api-presets，且保留预设 id、不影响其他预设', async () => {
    const { container } = await renderPage();

    await fireEvent.update(getUrlInput(container), 'https://changed.example.com/v2');
    await fireEvent.click(getSaveButton(container));

    await waitFor(() => {
      expect(savedPresetPayloads.length).toBe(1);
    });

    const saved = savedPresetPayloads[0]!;
    expect(saved.find(preset => preset.id === 'default')?.url).toBe('https://changed.example.com/v2');
    expect(saved.find(preset => preset.id === 'preset-b')?.url).toBe(PRESET_B.url);

    await waitFor(() => {
      expect(toastByTitle('保存成功')).toBeTruthy();
    });
  });

  it('切换预设：表单载入目标预设，并把新的选中项写给后端', async () => {
    const { container } = await renderPage();

    expect(getPresetLabel(container)).toBe(PRESET_A.name);

    await fireEvent.click(getPresetSelectorButton(container));
    await fireEvent.click(getPresetItem(container, PRESET_B.name));

    await waitFor(() => {
      expect(getUrlInput(container).value).toBe(PRESET_B.url);
    });
    expect(getPresetLabel(container)).toBe(PRESET_B.name);
    expect(settingsPuts).toContainEqual({ key: SETTING_KEYS.SELECTED_PRESET, value: PRESET_B.id });
  });
});

describe('ApiPresetPage 连接测试与模型列表', () => {
  it('测试连接：请求 /api/connection-test，期间按钮进入「测试中」', async () => {
    armConnectionGate();
    const { container } = await renderPage();

    await fireEvent.click(getTestConnectionButton(container));

    await waitFor(() => {
      expect(getTestConnectionButton(container).disabled).toBe(true);
    });
    expect(getTestConnectionButton(container).textContent).toContain('测试中');

    releaseConnectionGate();

    await waitFor(() => {
      expect(getTestConnectionButton(container).disabled).toBe(false);
    });
    expect(getTestConnectionButton(container).textContent).toContain('测试连接');
    expect(connectionRequests).toEqual([{ baseURL: PRESET_A.url, apiKey: PRESET_A.apiKey }]);

    await waitFor(() => {
      expect(toastByTitle('连接成功')?.message).toMatch(/网络延迟: \d+ms/);
    });
  });

  it('测试连接失败：给出错误通知，按钮恢复可用', async () => {
    connectionResult = { ok: false, status: 401, message: 'Invalid API key' };
    const { container } = await renderPage();

    await fireEvent.click(getTestConnectionButton(container));

    await waitFor(() => {
      expect(toastByTitle('连接失败')?.type).toBe('error');
    });
    expect(getTestConnectionButton(container).disabled).toBe(false);
  });

  it('获取模型列表：请求 /api/models，并把结果写回模型缓存设置', async () => {
    const { container } = await renderPage();

    await fireEvent.click(getFetchModelsButton(container));

    await waitFor(() => {
      expect(modelRequests.length).toBe(1);
    });
    expect(modelRequests[0]).toEqual({ baseURL: PRESET_A.url, apiKey: PRESET_A.apiKey });

    await waitFor(() => {
      expect(settingsPuts.find(put => put.key === SETTING_KEYS.MODELS)).toBeTruthy();
    });
    expect(toastByTitle('加载成功')?.message).toBe('已加载 2 个模型');
  });
});
