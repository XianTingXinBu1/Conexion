// @vitest-environment happy-dom
/**
 * PromptPresetPage 页面级测试。
 *
 * 覆盖用户可见链路：
 * - 加载：按 `insertPosition` 排序渲染条目，头部展示预设名与「x/y 个条目已启用」
 * - 恢复上次选中的预设：读 `conexion_selected_prompt_preset`
 * - 条目启用切换：写回 `enabled` 并区分「已启用 / 已禁用」两种提示
 * - 新建条目：名称必填（空名称保存禁用）→ 落库（enabled 默认 true、insertPosition 接在末尾）+ 提示
 * - 内联编辑：改名写回 + 提示；取消不落库
 * - 删除条目：确认框 → 落库移除 + 提示
 * - 拖拽排序：拖动手柄下移一项 → 落库顺序变化且 insertPosition 重排为 1..n
 * - 新建预设：条目取默认清单 → 落库 + 切换选中 + 提示
 * - 切换预设：写回设置里的选中 ID，且条目列表与标题同帧更换（回归：曾先 await
 *   设置写入再刷新条目，保存耗时期间标题已是新预设、列表还是旧条目）
 * - 重命名预设：落库新名称 + 提示 + 头部同步
 * - 删除预设：确认 → 落库移除、若删的是当前预设则自动切换到剩下的第一个
 * - 边界：只剩一个预设时菜单里不提供删除按钮
 *
 * 设计约束与其他页面级测试一致：
 * - 只在 fetch 边界打桩，不 mock 业务模块，因此会真实穿过
 *   PromptPresetPage -> promptPresetRepository / settingsRepository
 *   -> requestJson -> fetch 这条链路。
 * - 断言只看用户可见行为、发往本地的请求内容，以及通知内容。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor, type RenderResult } from '@testing-library/vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import PromptPresetPage from '@/components/PromptPresetPage.vue';
import { useNotifications } from '@/modules/notification';
import type { PromptItem, PromptPreset } from '@/types';

const SETTING_KEY = 'conexion_selected_prompt_preset';

/** insertPosition 故意与数组顺序不一致，用来验证页面按 insertPosition 排序 */
const itemA: PromptItem = {
  id: 'item-a',
  name: '条目A',
  description: 'A 的描述',
  prompt: 'A 的提示词',
  roleType: 'system',
  enabled: true,
  insertPosition: 3,
};

const itemB: PromptItem = {
  id: 'item-b',
  name: '条目B',
  description: 'B 的描述',
  prompt: 'B 的提示词',
  roleType: 'system',
  enabled: false,
  insertPosition: 1,
};

const itemC: PromptItem = {
  id: 'item-c',
  name: '条目C',
  description: 'C 的描述',
  prompt: 'C 的提示词',
  roleType: 'user',
  enabled: true,
  insertPosition: 2,
};

const onlyItem: PromptItem = {
  id: 'item-only',
  name: '唯一条目',
  description: '',
  prompt: '',
  roleType: 'system',
  enabled: true,
  insertPosition: 1,
};

/** 后端数据（每个用例重置） */
let store: PromptPreset[] = [];
let settingsStore: Record<string, unknown> = {};

/** 观测到的请求 */
let savedPresets: PromptPreset[][] = [];
let savedSettings: { key: string; value: unknown }[] = [];

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

  if (url.includes('/api/prompt-presets')) {
    if (method === 'PUT') {
      const body = JSON.parse(String(init.body)) as { presets: PromptPreset[] };
      store = structuredClone(body.presets);
      savedPresets.push(structuredClone(body.presets));
      return jsonResponse(store);
    }
    return jsonResponse(store);
  }

  if (url.includes('/api/settings/')) {
    const key = decodeURIComponent(url.split('/api/settings/')[1]!.split('?')[0]!);
    if (method === 'PUT') {
      const body = JSON.parse(String(init.body)) as { value: unknown };
      settingsStore[key] = body.value;
      savedSettings.push({ key, value: body.value });
      return jsonResponse({ value: body.value });
    }
    return jsonResponse({ value: settingsStore[key] });
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

const cards = (root: ParentNode): HTMLElement[] =>
  Array.from(root.querySelectorAll<HTMLElement>('.prompt-item'));

const itemNames = (root: ParentNode): (string | undefined)[] =>
  cards(root).map(card => card.querySelector('.prompt-name')?.textContent?.trim());

const getItemCard = (root: ParentNode, name: string): HTMLElement => {
  const card = cards(root).find(el => el.querySelector('.prompt-name')?.textContent?.trim() === name);
  if (!card) throw new Error(`未找到条目卡片：${name}`);
  return card;
};

/** 弹窗（Modal 不 Teleport，仍在容器内；这里统一从 body 查以兼容两种情况） */
const getModal = (title: string): HTMLElement => {
  const modal = Array.from(document.body.querySelectorAll<HTMLElement>('.modal-content'))
    .find(el => el.querySelector('.modal-title')?.textContent?.trim() === title);
  if (!modal) throw new Error(`未找到标题为「${title}」的弹窗`);
  return modal;
};

/** 确认框通过 Teleport 挂到 body */
const getConfirmButton = (): HTMLButtonElement => q<HTMLButtonElement>(document.body, '.btn-confirm');

const toastTitles = (): string[] => notifications.value.map(item => item.title);

const toastMessage = (title: string): string | undefined =>
  notifications.value.find(item => item.title === title)?.message;

/** 触摸拖拽事件（happy-dom 没有 TouchEvent 构造器） */
const touchEvent = (type: string, clientY: number): Event => {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'touches', { value: [{ clientY }] });
  return event;
};

const renderPage = async (): Promise<RenderResult> => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', component: { template: '<div />' } }],
  });
  await router.push('/');
  await router.isReady();

  const view = render(PromptPresetPage, { global: { plugins: [router] } });
  await waitFor(() => expect(view.container.querySelector('.prompt-item')).not.toBeNull());
  return view;
};

/** 打开「预设管理」面板 */
const openPresetMenu = async (view: RenderResult): Promise<HTMLElement> => {
  await fireEvent.click(q(view.container, '.page-title'));
  await waitFor(() => expect(view.container.querySelector('.preset-menu')).not.toBeNull());
  return q<HTMLElement>(view.container, '.preset-menu');
};

const ADD_BUTTON_LABEL = '添加';

beforeEach(() => {
  store = [
    {
      id: 'default',
      name: '默认预设',
      items: [structuredClone(itemA), structuredClone(itemB), structuredClone(itemC)],
      createdAt: 1,
      updatedAt: 1,
    },
    {
      id: 'preset-2',
      name: '备用预设',
      items: [structuredClone(onlyItem)],
      createdAt: 1,
      updatedAt: 1,
    },
  ];
  settingsStore = { [SETTING_KEY]: 'default' };
  savedPresets = [];
  savedSettings = [];
  clearAll();
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockClear();
});

afterEach(() => {
  clearAll();
  cleanup();
  vi.unstubAllGlobals();
});

describe('PromptPresetPage 加载', () => {
  it('按 insertPosition 排序渲染条目，并展示启用计数', async () => {
    const view = await renderPage();

    expect(q(view.container, '.page-title').textContent).toContain('默认预设');
    expect(q(view.container, '.page-subtitle').textContent?.trim()).toBe('2/3 个条目已启用');
    // insertPosition 1/2/3 -> 条目B、条目C、条目A
    expect(itemNames(view.container)).toEqual(['条目B', '条目C', '条目A']);
    // 未启用的条目带禁用态
    expect(getItemCard(view.container, '条目B').className).toContain('prompt-item--disabled');
  });

  it('恢复上次选中的预设，而不是第一个', async () => {
    settingsStore = { [SETTING_KEY]: 'preset-2' };

    const view = await renderPage();

    expect(q(view.container, '.page-title').textContent).toContain('备用预设');
    expect(q(view.container, '.page-subtitle').textContent?.trim()).toBe('1/1 个条目已启用');
    expect(itemNames(view.container)).toEqual(['唯一条目']);
  });

  it('设置里的预设已不存在时回退到默认列表的第一个', async () => {
    settingsStore = { [SETTING_KEY]: '已经删掉的预设' };

    const view = await renderPage();

    expect(q(view.container, '.page-title').textContent).toContain('默认预设');
  });
});

describe('PromptPresetPage 条目操作', () => {
  it('启用切换：两次点击分别写回 enabled 并提示已启用 / 已禁用', async () => {
    const view = await renderPage();
    const cardB = getItemCard(view.container, '条目B');

    await fireEvent.click(q(cardB, '.toggle-switch'));
    await waitFor(() => expect(savedPresets.length).toBe(1));
    const firstSave = savedPresets[0]![0]!;
    expect(firstSave.items.find(item => item.id === itemB.id)!.enabled).toBe(true);
    await waitFor(() => expect(toastTitles()).toContain('已启用'));
    expect(toastMessage('已启用')).toContain('条目B');
    expect(q(view.container, '.page-subtitle').textContent?.trim()).toBe('3/3 个条目已启用');

    await fireEvent.click(q(getItemCard(view.container, '条目B'), '.toggle-switch'));
    await waitFor(() => expect(savedPresets.length).toBe(2));
    expect(savedPresets[1]![0]!.items.find(item => item.id === itemB.id)!.enabled).toBe(false);
    await waitFor(() => expect(toastTitles()).toContain('已禁用'));
    expect(toastMessage('已禁用')).toContain('条目B');
    expect(q(view.container, '.page-subtitle').textContent?.trim()).toBe('2/3 个条目已启用');
  });

  it('新建条目：空名称禁止保存，填写后接在末尾落库并提示', async () => {
    const view = await renderPage();

    // 头部右侧是「+」图标按钮
    const headerButtons = Array.from(view.container.querySelectorAll<HTMLButtonElement>('.page-header .nav-btn'));
    await fireEvent.click(headerButtons[headerButtons.length - 1]!);
    await waitFor(() => expect(view.queryByText('新建条目')).not.toBeNull());

    const modal = getModal('新建条目');
    const saveButton = byText<HTMLButtonElement>(modal, '.btn-primary', ADD_BUTTON_LABEL);
    expect(saveButton.disabled).toBe(true);

    await fireEvent.update(q<HTMLInputElement>(modal, 'input[type="text"]'), '新条目');
    // 弹窗里有两个 textarea：0 是描述、1 是提示词
    const textareas = modal.querySelectorAll<HTMLTextAreaElement>('textarea');
    await fireEvent.update(textareas[0]!, '新条目的描述');
    await fireEvent.update(textareas[1]!, '新条目的提示词');
    expect(saveButton.disabled).toBe(false);
    await fireEvent.click(byText<HTMLButtonElement>(modal, '.role-type-btn', 'User'));
    await fireEvent.click(saveButton);

    await waitFor(() => expect(savedPresets.length).toBe(1));
    const created = savedPresets[0]![0]!.items.find(item => item.name === '新条目')!;
    expect(created).toBeTruthy();
    expect(created.description).toBe('新条目的描述');
    expect(created.prompt).toBe('新条目的提示词');
    expect(created.roleType).toBe('user');
    expect(created.enabled).toBe(true);
    expect(created.insertPosition).toBe(4);

    await waitFor(() => expect(toastTitles()).toContain('条目已添加'));
    expect(toastMessage('条目已添加')).toContain('新条目');
    // 创建模式保存后自动关闭弹窗
    await waitFor(() => expect(view.queryByText('新建条目')).toBeNull());
    expect(itemNames(view.container)).toEqual(['条目B', '条目C', '条目A', '新条目']);
    expect(q(view.container, '.page-subtitle').textContent?.trim()).toBe('3/4 个条目已启用');
  });

  it('内联编辑：保存写回新名称，取消不落库', async () => {
    const view = await renderPage();
    const cardA = getItemCard(view.container, '条目A');

    await fireEvent.click(q(cardA, '.action-btn--edit'));
    await waitFor(() => expect(cardA.querySelector('.edit-form')).not.toBeNull());

    await fireEvent.update(q<HTMLInputElement>(cardA, '.edit-form input[type="text"]'), '条目A改');
    await fireEvent.click(byText<HTMLButtonElement>(cardA, '.form-action-btn', '保存'));

    await waitFor(() => expect(savedPresets.length).toBe(1));
    expect(savedPresets[0]![0]!.items.find(item => item.id === itemA.id)!.name).toBe('条目A改');
    await waitFor(() => expect(toastTitles()).toContain('条目已更新'));
    expect(toastMessage('条目已更新')).toContain('条目A改');
    expect(itemNames(view.container)).toEqual(['条目B', '条目C', '条目A改']);

    // 取消：改动不落库
    const renamedCard = getItemCard(view.container, '条目A改');
    await fireEvent.click(q(renamedCard, '.action-btn--edit'));
    await fireEvent.update(q<HTMLInputElement>(renamedCard, '.edit-form input[type="text"]'), '不该保存');
    await fireEvent.click(byText<HTMLButtonElement>(renamedCard, '.form-action-btn', '取消'));

    await waitFor(() => expect(renamedCard.querySelector('.edit-form')).toBeNull());
    expect(savedPresets.length).toBe(1);
    expect(itemNames(view.container)).toEqual(['条目B', '条目C', '条目A改']);
  });

  it('删除条目：先确认再落库，并提示已删除', async () => {
    const view = await renderPage();

    await fireEvent.click(q(getItemCard(view.container, '条目C'), '.action-btn--delete'));
    await waitFor(() => expect(document.body.querySelector('.btn-confirm')).not.toBeNull());
    expect(document.body.textContent).toContain('条目C');

    await fireEvent.click(getConfirmButton());

    await waitFor(() => expect(savedPresets.length).toBe(1));
    expect(savedPresets[0]![0]!.items.map(item => item.id)).toEqual([itemB.id, itemA.id]);
    await waitFor(() => expect(toastTitles()).toContain('条目已删除'));
    expect(itemNames(view.container)).toEqual(['条目B', '条目A']);
  });

  it('拖拽排序：把第一项拖到第二项之后，落库顺序与 insertPosition 同步重排', async () => {
    const view = await renderPage();
    const handles = view.container.querySelectorAll<HTMLElement>('.prompt-item .drag-handle');
    expect(handles.length).toBe(3);

    // 触摸路径：手势位移 +74px（列表项节距）→ 落点在第二个槽位
    handles[0]!.dispatchEvent(touchEvent('touchstart', 0));
    handles[0]!.dispatchEvent(touchEvent('touchmove', 74));
    await waitFor(() => expect(q(view.container, '.prompt-item--insert-before')).toBeTruthy());
    handles[0]!.dispatchEvent(touchEvent('touchend', 74));

    await waitFor(() => expect(savedPresets.length).toBe(1));
    const items = savedPresets[0]![0]!.items;
    expect(items.map(item => item.id)).toEqual([itemC.id, itemB.id, itemA.id]);
    expect(items.map(item => item.insertPosition)).toEqual([1, 2, 3]);
    expect(itemNames(view.container)).toEqual(['条目C', '条目B', '条目A']);
  });
});

describe('PromptPresetPage 预设管理', () => {
  it('新建预设：取默认条目清单、落库、切换选中并提示', async () => {
    const view = await renderPage();
    const menu = await openPresetMenu(view);

    await fireEvent.click(byText<HTMLButtonElement>(menu, '.btn-full', '添加预设'));
    const modal = getModal('添加预设');
    const addButton = byText<HTMLButtonElement>(modal, '.btn-primary', ADD_BUTTON_LABEL);
    expect(addButton.disabled).toBe(true);

    await fireEvent.update(q<HTMLInputElement>(modal, 'input[type="text"]'), '新预设');
    await fireEvent.click(addButton);

    await waitFor(() => expect(savedPresets.length).toBe(1));
    const created = savedPresets[0]!.find(preset => preset.name === '新预设')!;
    expect(created).toBeTruthy();
    expect(created.items.length).toBe(8);
    expect(created.items.every(item => item.enabled)).toBe(true);

    // 新建后自动选中：写回设置并切到该预设
    await waitFor(() => expect(savedSettings.length).toBeGreaterThan(0));
    expect(savedSettings[savedSettings.length - 1]).toEqual({ key: SETTING_KEY, value: created.id });
    await waitFor(() => expect(q(view.container, '.page-title').textContent).toContain('新预设'));
    expect(q(view.container, '.page-subtitle').textContent?.trim()).toBe('8/8 个条目已启用');
    await waitFor(() => expect(toastTitles()).toContain('预设已创建'));
    expect(toastMessage('预设已创建')).toContain('新预设');
  });

  it('切换预设：写回选中的 ID，条目列表随之更换', async () => {
    const view = await renderPage();
    const menu = await openPresetMenu(view);

    await fireEvent.click(byText<HTMLButtonElement>(menu, '.preset-option-name', '备用预设'));

    await waitFor(() => expect(savedSettings).toContainEqual({ key: SETTING_KEY, value: 'preset-2' }));
    await waitFor(() => expect(q(view.container, '.page-title').textContent).toContain('备用预设'));
    expect(itemNames(view.container)).toEqual(['唯一条目']);
    // 只是切换选中，不应改动预设内容
    expect(savedPresets).toEqual([]);
  });

  it('重命名预设：落库新名称、提示一次并同步头部', async () => {
    const view = await renderPage();
    const menu = await openPresetMenu(view);

    await fireEvent.click(q<HTMLButtonElement>(menu, '.preset-option .preset-action-btn'));
    const modal = getModal('重命名预设');
    const input = q<HTMLInputElement>(modal, 'input[type="text"]');
    expect(input.value).toBe('默认预设');

    await fireEvent.update(input, '改过的预设');
    await fireEvent.click(byText<HTMLButtonElement>(modal, '.btn-primary', '保存'));

    await waitFor(() => expect(savedPresets.length).toBe(1));
    expect(savedPresets[0]!.find(preset => preset.id === 'default')!.name).toBe('改过的预设');
    await waitFor(() => expect(toastTitles()).toContain('预设已重命名'));
    expect(toastTitles().filter(title => title === '预设已重命名')).toHaveLength(1);
    expect(q(view.container, '.page-title').textContent).toContain('改过的预设');
  });

  it('删除预设：确认后落库移除，并把选中切到剩下的第一个', async () => {
    const view = await renderPage();
    const menu = await openPresetMenu(view);

    await fireEvent.click(q<HTMLButtonElement>(menu, '.preset-option .preset-action-btn--delete'));
    await waitFor(() => expect(document.body.querySelector('.btn-confirm')).not.toBeNull());
    expect(document.body.textContent).toContain('默认预设');

    await fireEvent.click(getConfirmButton());

    await waitFor(() => expect(savedPresets.length).toBe(1));
    expect(savedPresets[0]!.map(preset => preset.id)).toEqual(['preset-2']);
    await waitFor(() => expect(toastTitles()).toContain('预设已删除'));
    await waitFor(() => expect(q(view.container, '.page-title').textContent).toContain('备用预设'));
    await waitFor(() => expect(savedSettings).toContainEqual({ key: SETTING_KEY, value: 'preset-2' }));
  });

  it('只剩一个预设时，菜单里不提供删除按钮', async () => {
    store = [store[0]!];

    const view = await renderPage();
    const menu = await openPresetMenu(view);

    expect(menu.querySelectorAll('.preset-option')).toHaveLength(1);
    expect(menu.querySelector('.preset-action-btn--delete')).toBeNull();
  });
});
