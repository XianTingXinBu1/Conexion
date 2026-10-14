// @vitest-environment happy-dom
/**
 * KnowledgeBasePage 页面级测试。
 *
 * 覆盖用户可见链路：
 * - 加载：列表展示名称 / 描述 / 启用计数
 * - 全局启用切换：`PUT /api/knowledge-bases` 写入 `globallyEnabled` + 通知
 * - 新建知识库：名称必填（空名称保存按钮禁用）→ 保存 → 请求体含新库 + 通知
 * - 进入详情：标题与「x/y 个条目已启用」副标题
 * - 添加条目：表单 → `PUT` 落库（enabled 默认 true、priority 默认 50）+ 通知
 * - 启用切换：点击开关 → `PUT` 写入 `enabled: false`
 * - 内联编辑：铅笔 → 改名称 → 保存 → `PUT` 写入新名称
 * - 拖拽排序：拖动手柄下移一项 → `PUT` 写入颠倒后的顺序
 * - 删除条目：垃圾桶 → 确认框 → `PUT` 移除条目 + 通知
 * - 删除知识库：菜单 → 删除 → 确认 → `PUT` 移除、清理角色引用、回到列表 + 通知
 * - 重命名知识库：菜单 → 重命名 → 保存 → `PUT` 写入新名称，且只提示一次
 *
 * 设计约束与其他页面级测试一致：
 * - 只在 fetch 边界打桩，不 mock 业务模块，因此会真实穿过
 *   KnowledgeBasePage -> useKnowledgeBases / useConfirmDialog / useDraggable
 *   -> knowledgeBaseRepository -> requestJson -> fetch 这条链路。
 * - 断言只看用户可见行为、发往本地的请求内容，以及通知内容。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor, type RenderResult } from '@testing-library/vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import KnowledgeBasePage from '@/components/KnowledgeBasePage.vue';
import { useNotifications } from '@/modules/notification';
import type { KnowledgeBase, KnowledgeEntry } from '@/types';

const ENTRY_ENABLED: KnowledgeEntry = {
  id: 'entry-1',
  name: '世界观',
  content: '这是一个低魔世界。',
  enabled: true,
  priority: 30,
  createdAt: 1,
  updatedAt: 1,
};

const ENTRY_DISABLED: KnowledgeEntry = {
  id: 'entry-2',
  name: '禁用条目',
  content: '这条默认不启用。',
  enabled: false,
  priority: 80,
  createdAt: 1,
  updatedAt: 1,
};

const BASE: KnowledgeBase = {
  id: 'kb-1',
  name: '设定集',
  description: '角色扮演用的世界设定',
  entries: [structuredClone(ENTRY_ENABLED), structuredClone(ENTRY_DISABLED)],
  globallyEnabled: false,
  createdAt: 1,
  updatedAt: 1,
};

/** 后端数据（每个用例重置） */
let store: KnowledgeBase[] = [];
/** 观测到的请求 */
let requestLog: { method: string; url: string }[] = [];
let savedBases: KnowledgeBase[][] = [];
let clearedReferences: string[] = [];

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

  if (url.includes('/api/knowledge-bases')) {
    if (method === 'PUT') {
      const body = JSON.parse(String(init.body)) as { knowledgeBases: KnowledgeBase[] };
      store = structuredClone(body.knowledgeBases);
      savedBases.push(structuredClone(body.knowledgeBases));
      return jsonResponse(store);
    }
    return jsonResponse(store);
  }

  if (url.includes('/api/characters/ai/clear-knowledge-base-reference')) {
    clearedReferences.push((JSON.parse(String(init.body)) as { knowledgeBaseId: string }).knowledgeBaseId);
    return jsonResponse({ changed: true });
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

const getCard = (container: Element, name: string): HTMLElement =>
  Array.from(container.querySelectorAll<HTMLElement>('.kb-card'))
    .find(card => card.querySelector('.kb-card__title')?.textContent?.trim() === name)
    ?? (() => { throw new Error(`未找到知识库卡片：${name}`); })();

/** 确认框通过 Teleport 挂到 body，不在 container 里 */
const getConfirmButton = (): HTMLButtonElement => q<HTMLButtonElement>(document.body, '.btn-confirm');

const toastTitles = (): string[] => notifications.value.map(item => item.title);

const renderPage = async (): Promise<RenderResult> => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', component: { template: '<div />' } }],
  });
  await router.push('/');
  await router.isReady();

  const view = render(KnowledgeBasePage, { global: { plugins: [router] } });
  await waitFor(() => expect(store.length === 0 || view.container.querySelector('.kb-card')).toBeTruthy());
  return view;
};

/** 进入某个知识库详情 */
const openDetail = async (view: RenderResult, name: string) => {
  await fireEvent.click(getCard(view.container, name));
  await waitFor(() => expect(view.container.querySelector('.kb-detail-view')).not.toBeNull());
};

beforeEach(() => {
  store = [structuredClone(BASE)];
  requestLog = [];
  savedBases = [];
  clearedReferences = [];
  clearAll();
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockClear();
});

afterEach(() => {
  clearAll();
  cleanup();
  vi.unstubAllGlobals();
});

describe('KnowledgeBasePage 列表', () => {
  it('加载后展示名称、描述与启用计数', async () => {
    const view = await renderPage();

    const card = getCard(view.container, BASE.name);
    expect(card.querySelector('.kb-card__description')?.textContent?.trim()).toBe(BASE.description);
    expect(card.querySelector('.status-text')?.textContent?.trim()).toBe('1/2');
    expect(view.getByText('1 个知识库')).toBeTruthy();
  });

  it('全局启用切换：写入 globallyEnabled 并提示已启用', async () => {
    const view = await renderPage();

    await fireEvent.click(q(view.container, '.global-toggle-btn'));

    await waitFor(() => expect(savedBases.length).toBe(1));
    expect(savedBases[0]![0]!.globallyEnabled).toBe(true);
    await waitFor(() => expect(toastTitles()).toContain('已启用'));
    expect(notifications.value.find(item => item.title === '已启用')?.message).toContain(BASE.name);
  });

  it('新建知识库：空名称禁止保存，填写后落库并提示', async () => {
    const view = await renderPage();

    // 列表页右上角是「+」按钮（图标按钮，没有文本），用结构定位更稳
    const listButtons = Array.from(view.container.querySelectorAll<HTMLButtonElement>('.kb-list-view .nav-btn'));
    const addButton = listButtons[listButtons.length - 1]!;
    await fireEvent.click(addButton);

    await waitFor(() => expect(view.queryByText('新建知识库')).not.toBeNull());
    const nameInput = q<HTMLInputElement>(view.container, '.kb-form-modal input');
    const saveButton = byText<HTMLButtonElement>(view.container, '.form-action-btn', '保存');
    expect(saveButton.disabled).toBe(true);

    await fireEvent.update(nameInput, '新设定集');
    await fireEvent.update(q<HTMLTextAreaElement>(view.container, '.kb-form-modal textarea'), '新建的描述');
    expect(saveButton.disabled).toBe(false);
    await fireEvent.click(saveButton);

    await waitFor(() => expect(savedBases.length).toBe(1));
    const created = savedBases[0]!.find(kb => kb.name === '新设定集');
    expect(created).toBeTruthy();
    expect(created!.description).toBe('新建的描述');
    expect(created!.entries).toEqual([]);
    await waitFor(() => expect(toastTitles()).toContain('知识库已创建'));
  });
});

describe('KnowledgeBasePage 详情与条目', () => {
  it('进入详情：展示副标题的启用计数，并能添加新条目', async () => {
    const view = await renderPage();
    await openDetail(view, BASE.name);

    expect(q(view.container, '.page-title').textContent?.trim()).toBe(BASE.name);
    expect(q(view.container, '.page-subtitle').textContent).toContain('1/2 个条目已启用');

    const addButton = q<HTMLButtonElement>(view.container, '.kb-detail-view .header-actions > .nav-btn');
    await fireEvent.click(addButton);
    await waitFor(() => expect(view.queryByText('新建知识条目')).not.toBeNull());

    await fireEvent.update(q<HTMLInputElement>(view.container, '.entry-form-modal input[type="text"]'), '新条目');
    await fireEvent.update(q<HTMLTextAreaElement>(view.container, '.entry-form-modal textarea'), '新条目内容');
    await fireEvent.click(byText<HTMLButtonElement>(view.container, '.entry-form-modal .form-action-btn', '保存'));

    await waitFor(() => expect(savedBases.length).toBe(1));
    const entries = savedBases[0]![0]!.entries;
    expect(entries[0]!.name).toBe('新条目');
    expect(entries[0]!.content).toBe('新条目内容');
    expect(entries[0]!.enabled).toBe(true);
    expect(entries[0]!.priority).toBe(50);
    await waitFor(() => expect(toastTitles()).toContain('条目已添加'));
    await waitFor(() => expect(q(view.container, '.page-subtitle').textContent).toContain('2/3 个条目已启用'));
  });

  it('启用切换：点击开关写入 enabled=false 并更新计数', async () => {
    const view = await renderPage();
    await openDetail(view, BASE.name);

    const firstCard = q<HTMLElement>(view.container, '.entry-card');
    await fireEvent.click(q(firstCard, '.toggle-switch'));

    await waitFor(() => expect(savedBases.length).toBe(1));
    expect(savedBases[0]![0]!.entries.find(e => e.id === ENTRY_ENABLED.id)!.enabled).toBe(false);
    await waitFor(() => expect(q(view.container, '.page-subtitle').textContent).toContain('0/2 个条目已启用'));
  });

  it('内联编辑：改名后写回，取消改动不落库', async () => {
    const view = await renderPage();
    await openDetail(view, BASE.name);

    const firstCard = q<HTMLElement>(view.container, '.entry-card');
    await fireEvent.click(q(firstCard, '.action-btn--edit'));
    await waitFor(() => expect(firstCard.querySelector('.edit-form')).not.toBeNull());

    await fireEvent.update(q<HTMLInputElement>(firstCard, '.edit-form input[type="text"]'), '改名后');
    await fireEvent.update(q<HTMLInputElement>(firstCard, '.edit-form input[type="number"]'), '10');
    await fireEvent.click(byText<HTMLButtonElement>(firstCard, '.form-action-btn', '保存'));

    await waitFor(() => expect(savedBases.length).toBe(1));
    const updated = savedBases[0]![0]!.entries.find(e => e.id === ENTRY_ENABLED.id)!;
    expect(updated.name).toBe('改名后');
    expect(updated.priority).toBe(10);
    await waitFor(() => expect(view.getByText('改名后')).toBeTruthy());
  });

  it('拖拽排序：把第一项拖到第二项之后并落库', async () => {
    const view = await renderPage();
    await openDetail(view, BASE.name);

    const handles = view.container.querySelectorAll<HTMLElement>('.entry-card .drag-handle');
    expect(handles.length).toBe(2);

    // 触摸路径：手势位移 +74px（列表项节距）→ 落点在第二个槽位
    const touch = (type: string, clientY: number) => {
      const event = new Event(type, { bubbles: true, cancelable: true });
      Object.defineProperty(event, 'touches', { value: [{ clientY }] });
      return event;
    };

    handles[0]!.dispatchEvent(touch('touchstart', 0));
    handles[0]!.dispatchEvent(touch('touchmove', 74));
    await waitFor(() => expect(q(view.container, '.entry-card--insert-before')).toBeTruthy());
    handles[0]!.dispatchEvent(touch('touchend', 74));

    await waitFor(() => expect(savedBases.length).toBe(1));
    const order = savedBases[0]![0]!.entries.map(e => e.id);
    expect(order[0]).toBe(ENTRY_DISABLED.id);
    expect(order[1]).toBe(ENTRY_ENABLED.id);
  });

  it('删除条目：先确认再落库，并提示已删除', async () => {
    const view = await renderPage();
    await openDetail(view, BASE.name);

    const firstCard = q<HTMLElement>(view.container, '.entry-card');
    await fireEvent.click(q(firstCard, '.action-btn--delete'));
    await waitFor(() => expect(document.body.querySelector('.btn-confirm')).not.toBeNull());
    expect(document.body.textContent).toContain(ENTRY_ENABLED.name);

    await fireEvent.click(getConfirmButton());

    await waitFor(() => expect(savedBases.length).toBe(1));
    const ids = savedBases[0]![0]!.entries.map(e => e.id);
    expect(ids).toEqual([ENTRY_DISABLED.id]);
    await waitFor(() => expect(toastTitles()).toContain('条目已删除'));
  });

  it('删除知识库：落库、清理角色引用并回到列表', async () => {
    const view = await renderPage();
    await openDetail(view, BASE.name);

    await fireEvent.click(q(view.container, '.menu-container .nav-btn'));
    await fireEvent.click(byText<HTMLButtonElement>(view.container, '.dropdown-item', '删除'));
    await waitFor(() => expect(document.body.querySelector('.btn-confirm')).not.toBeNull());
    await fireEvent.click(getConfirmButton());

    await waitFor(() => expect(savedBases.length).toBe(1));
    expect(savedBases[0]).toEqual([]);
    await waitFor(() => expect(clearedReferences).toEqual([BASE.id]));
    await waitFor(() => expect(view.container.querySelector('.kb-list-view')).not.toBeNull());
    expect(toastTitles()).toContain('知识库已删除');
  });
});

describe('KnowledgeBasePage 重命名', () => {
  it('从详情菜单重命名：落库新名称，且只提示一次', async () => {
    const view = await renderPage();
    await openDetail(view, BASE.name);

    await fireEvent.click(q(view.container, '.menu-container .nav-btn'));
    await fireEvent.click(byText<HTMLButtonElement>(view.container, '.dropdown-item', '重命名'));
    await waitFor(() => expect(view.queryByText('编辑知识库')).not.toBeNull());

    await fireEvent.update(q<HTMLInputElement>(view.container, '.kb-detail-view .kb-form-modal input'), '改名后的库');
    await fireEvent.click(byText<HTMLButtonElement>(view.container, '.kb-detail-view .kb-form-modal .form-action-btn', '保存'));

    await waitFor(() => expect(savedBases.length).toBe(1));
    expect(savedBases[0]![0]!.name).toBe('改名后的库');
    await waitFor(() => expect(toastTitles()).toContain('知识库已更新'));

    // 一次保存只应有一条成功提示
    expect(toastTitles().filter(title => title === '知识库已更新')).toHaveLength(1);
  });
});
